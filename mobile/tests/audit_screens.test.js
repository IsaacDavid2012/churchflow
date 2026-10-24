const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const traverse = require('@babel/traverse').default;

const jsGlobals = new Set([
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
  'JSON', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'Set', 'Map', 'WeakSet', 'WeakMap', 'Buffer', 'global', 'window', 'process',
  'Intl', 'URL', 'URLSearchParams', 'fetch', 'FormData', 'Headers', 'Request', 'Response',
  'undefined', 'NaN', 'Infinity'
]);

const mobileRoot = path.resolve(__dirname, '..');
const srcDir = path.join(mobileRoot, 'src');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(full));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(full);
    }
  });
  return results;
}

const allFiles = [path.join(mobileRoot, 'App.js'), ...getAllJsFiles(srcDir)];

describe('Mobile Codebase Static & AST Audit', () => {
  test('No undefined JSX components exist across App.js and src/**', () => {
    const failures = [];

    allFiles.forEach((file) => {
      const code = fs.readFileSync(file, 'utf8');
      const ast = babel.parseSync(code, {
        filename: file,
        presets: [path.join(mobileRoot, 'node_modules/babel-preset-expo')],
        configFile: false,
        babelrc: false,
      });

      traverse(ast, {
        JSXOpeningElement(p) {
          const nameNode = p.node.name;
          if (nameNode.type === 'JSXIdentifier') {
            const name = nameNode.name;
            if (/^[a-z]/.test(name)) return;
            if (!p.scope.hasBinding(name)) {
              failures.push({ file: path.relative(mobileRoot, file), component: name });
            }
          }
        },
      });
    });

    assert.strictEqual(
      failures.length,
      0,
      `Found undefined JSX components:\n${JSON.stringify(failures, null, 2)}`
    );
  });

  test('No undeclared variables exist across App.js and src/**', () => {
    const allowedGlobals = new Set(['require']);
    const failures = [];

    allFiles.forEach((file) => {
      const code = fs.readFileSync(file, 'utf8');
      const ast = babel.parseSync(code, {
        filename: file,
        presets: [path.join(mobileRoot, 'node_modules/babel-preset-expo')],
        configFile: false,
        babelrc: false,
      });

      traverse(ast, {
        ReferencedIdentifier(nodePath) {
          const name = nodePath.node.name;
          if (jsGlobals.has(name) || allowedGlobals.has(name)) return;
          if (nodePath.scope.hasBinding(name)) return;
          if (nodePath.parentPath.isMemberExpression({ property: nodePath.node, computed: false })) return;
          failures.push({ file: path.relative(mobileRoot, file), variable: name });
        },
      });
    });

    assert.strictEqual(
      failures.length,
      0,
      `Found undeclared variables:\n${JSON.stringify(failures, null, 2)}`
    );
  });

  test('No missing styles used in StyleSheet.create across App.js and src/**', () => {
    const failures = [];

    allFiles.forEach((file) => {
      const code = fs.readFileSync(file, 'utf8');
      const ast = babel.parseSync(code, {
        filename: file,
        presets: [path.join(mobileRoot, 'node_modules/babel-preset-expo')],
        configFile: false,
        babelrc: false,
      });

      const styleKeys = new Set();
      traverse(ast, {
        CallExpression(p) {
          if (
            p.node.callee?.object?.name === 'StyleSheet' &&
            p.node.callee?.property?.name === 'create'
          ) {
            const arg = p.node.arguments[0];
            if (arg?.type === 'ObjectExpression') {
              arg.properties.forEach((prop) => {
                if (prop.key) styleKeys.add(prop.key.name || prop.key.value);
              });
            }
          }
        },
      });

      if (styleKeys.size === 0) return;

      traverse(ast, {
        MemberExpression(p) {
          if (p.node.object?.name === 'styles' && p.node.property) {
            const propName = p.node.property.name || p.node.property.value;
            if (propName && !styleKeys.has(propName)) {
              failures.push({ file: path.relative(mobileRoot, file), missingStyle: propName });
            }
          }
        },
      });
    });

    assert.strictEqual(
      failures.length,
      0,
      `Found missing styles:\n${JSON.stringify(failures, null, 2)}`
    );
  });

  test('SongBookScreen has KeyboardAvoidingView properly imported', () => {
    const code = fs.readFileSync(path.join(srcDir, 'screens/SongBookScreen.js'), 'utf8');
    assert.match(
      code,
      /KeyboardAvoidingView/,
      'KeyboardAvoidingView should be imported and present in SongBookScreen.js'
    );
  });

  test('App.js integrates ErrorBoundary wrapping content', () => {
    const code = fs.readFileSync(path.join(mobileRoot, 'App.js'), 'utf8');
    assert.match(
      code,
      /import ErrorBoundary from '\.\/src\/components\/ErrorBoundary'/,
      'App.js should import ErrorBoundary'
    );
    assert.match(
      code,
      /<ErrorBoundary/s,
      'App.js should wrap content with ErrorBoundary'
    );
  });

  test('SongBookScreen guards against undefined setlist songs on line 1224', () => {
    const code = fs.readFileSync(path.join(srcDir, 'screens/SongBookScreen.js'), 'utf8');
    assert.ok(
      code.includes('selectedSetlist && Array.isArray(selectedSetlist.songs)'),
      'selectedSetlist.songs must be guarded with Array.isArray'
    );
  });

  test('SongBookScreen integrates DocumentPicker and SBP file picker', () => {
    const code = fs.readFileSync(path.join(srcDir, 'screens/SongBookScreen.js'), 'utf8');
    assert.match(code, /import \* as DocumentPicker from 'expo-document-picker';/);
    assert.match(code, /handlePickSbpFile/);
    assert.match(code, /processIncomingSbp/);
  });

  test('SongBookScreen features slim reader header and controls strip', () => {
    const code = fs.readFileSync(path.join(srcDir, 'screens/SongBookScreen.js'), 'utf8');
    assert.match(code, /slimReaderHeader/);
    assert.match(code, /slimControlsStrip/);
    assert.match(code, /isReaderMenuOpen/);
  });

  test('MediaAttachmentCard safely resolves baseUrl without crashing if undefined', () => {
    const code = fs.readFileSync(path.join(srcDir, 'components/MediaAttachmentCard.js'), 'utf8');
    assert.match(code, /API_BASE_URL/);
    assert.ok(
      code.includes('(api?.baseUrl || API_BASE_URL'),
      'MediaAttachmentCard must have fallback for baseUrl'
    );
  });

  test('chordProHtml produces 2-column layout with unbroken section blocks', () => {
    const { renderChordProToHtml, buildPrintableBookletHtml } = require('../../backend/src/utils/chordProHtml');
    const html = buildPrintableBookletHtml({
      title: 'Sunday Worship',
      songs: [{ title: 'Way Maker', artist: 'Sinach', key: 'E', content: '{c:Verse 1}\nYou are here\n[E]Moving in our [B]midst' }],
    });
    assert.ok(html.includes('column-count: 2'), 'Must include 2-column layout');
    assert.ok(html.includes('break-inside: avoid'), 'Must keep section blocks unbroken');
    assert.ok(html.includes('Way Maker'));
  });

  test('SongBookScreen supports horizontal swipe gestures to change songs in setlists', () => {
    const code = fs.readFileSync(path.join(srcDir, 'screens/SongBookScreen.js'), 'utf8');
    assert.match(code, /PanResponder/);
    assert.match(code, /panResponder\.panHandlers/);
    assert.match(code, /navigateSetlist/);
    assert.match(code, /swipeToast/);
    assert.ok(code.includes('selectedSetlist && Array.isArray(selectedSetlist.songs)'));
  });
});
