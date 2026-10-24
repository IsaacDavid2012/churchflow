import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (e) {
        // ignore
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDark = this.props.isDark ?? false;
      const themeColors = {
        bg: isDark ? '#020617' : '#ffffff',
        card: isDark ? '#0f172a' : '#f8fafc',
        border: isDark ? '#1e293b' : '#eadbc4',
        text: isDark ? '#ffffff' : '#0f172a',
        subText: isDark ? '#94a3b8' : '#64748b',
        primary: '#c59c6c',
      };

      return (
        <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="alert-circle-outline" size={38} color="#ef4444" />
            </View>

            <Text style={[styles.title, { color: themeColors.text }]}>
              Something went wrong
            </Text>

            <Text style={[styles.message, { color: themeColors.subText }]}>
              An error occurred while loading this screen. Your other screens and data are safe.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: themeColors.primary }]}
                onPress={this.handleReset}
              >
                <Ionicons name="refresh" size={16} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </TouchableOpacity>

              {this.props.onNavigateHome && (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: themeColors.border }]}
                  onPress={this.props.onNavigateHome}
                >
                  <Text style={[styles.secondaryBtnText, { color: themeColors.text }]}>
                    Go to Services
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
            >
              <Text style={[styles.detailsToggleText, { color: themeColors.subText }]}>
                {this.state.showDetails ? 'Hide technical details ▲' : 'Show technical details ▼'}
              </Text>
            </TouchableOpacity>

            {this.state.showDetails && (
              <ScrollView style={[styles.detailsBox, { borderColor: themeColors.border }]}>
                <Text style={styles.errorText}>
                  {this.state.error?.toString?.() || 'Unknown error'}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailsToggle: {
    marginTop: 16,
    paddingVertical: 4,
  },
  detailsToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsBox: {
    marginTop: 10,
    maxHeight: 140,
    width: '100%',
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  stackText: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'monospace',
  },
});
