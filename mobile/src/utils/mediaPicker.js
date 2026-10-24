import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB limit strictly enforced

/**
 * Pick a single image or video from the device library strictly under 20MB.
 */
export async function pickMediaAttachment() {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your media library to send photos and videos.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    // File size check:
    let fileSize = asset.fileSize;
    if (!fileSize && asset.uri) {
      try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        fileSize = info.size;
      } catch (e) {}
    }

    if (fileSize && fileSize > MAX_MEDIA_BYTES) {
      Alert.alert(
        'File Too Large',
        `The selected ${asset.type === 'video' ? 'video' : 'photo'} is ${(fileSize / (1024 * 1024)).toFixed(1)}MB. Photos and videos must be below 20MB to upload.`
      );
      return null;
    }

    // Read base64 content
    let base64 = asset.base64;
    if (!base64 && asset.uri) {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (base64) {
      const estimatedBytes = Math.round(base64.length * 0.75);
      if (estimatedBytes > MAX_MEDIA_BYTES) {
        Alert.alert(
          'File Too Large',
          `The selected file is ${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB. Please select a photo or video below 20MB.`
        );
        return null;
      }
      if (!fileSize) fileSize = estimatedBytes;
    }

    const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
    const defaultExt = isVideo ? 'mp4' : 'jpg';
    const fallbackName = `${isVideo ? 'video' : 'photo'}_${Date.now()}.${defaultExt}`;
    const fileName = asset.fileName || fallbackName;
    const fileType = asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    return {
      uri: asset.uri,
      fileName,
      fileType,
      fileSize: fileSize || 0,
      base64,
      type: isVideo ? 'video' : 'image',
    };
  } catch (err) {
    Alert.alert('Media Error', err.message || 'Could not select media');
    return null;
  }
}

/**
 * Pick up to 10 photos or media items strictly under 20MB each.
 */
export async function pickMultipleMediaAttachments(maxItems = 10) {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your media library to select photos.'
      );
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: maxItems,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const selectedItems = [];

    for (const asset of result.assets) {
      let fileSize = asset.fileSize;
      if (!fileSize && asset.uri) {
        try {
          const info = await FileSystem.getInfoAsync(asset.uri);
          fileSize = info.size;
        } catch (e) {}
      }

      if (fileSize && fileSize > MAX_MEDIA_BYTES) {
        Alert.alert(
          'File Skipped',
          `"${asset.fileName || 'file'}" is ${(fileSize / (1024 * 1024)).toFixed(1)}MB and exceeds the 20MB limit.`
        );
        continue;
      }

      let base64 = asset.base64;
      if (!base64 && asset.uri) {
        try {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {}
      }

      const isVideo = asset.type === 'video' || (asset.mimeType && asset.mimeType.startsWith('video/'));
      const defaultExt = isVideo ? 'mp4' : 'jpg';
      const fallbackName = `${isVideo ? 'video' : 'photo'}_${Date.now()}_${Math.random().toString(36).substring(7)}.${defaultExt}`;

      selectedItems.push({
        uri: asset.uri,
        fileName: asset.fileName || fallbackName,
        fileType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        fileSize: fileSize || (base64 ? Math.round(base64.length * 0.75) : 0),
        base64,
        type: isVideo ? 'video' : 'image',
      });
    }

    return selectedItems;
  } catch (err) {
    Alert.alert('Media Error', err.message || 'Could not select media');
    return [];
  }
}
