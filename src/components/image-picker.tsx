import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../lib/theme-context';
import { apiFetch } from '../lib/api';

interface ImagePickerFieldProps {
  label: string;
  value: string; // The URL of the uploaded image
  onChange: (url: string) => void;
}

export function ImagePickerField({ label, value, onChange }: ImagePickerFieldProps) {
  const Colors = useColors();
  const [uploading, setUploading] = useState(false);

  const processAndUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploading(true);
      
      // Compress the image
      const manipResult = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1000 } }], // Resize width to 1000px, height auto
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipResult.base64) {
        throw new Error("Gagal mengompres gambar.");
      }

      const base64Image = `data:image/jpeg;base64,${manipResult.base64}`;

      // Upload to backend
      const res = await apiFetch<{ url: string }>('/upload-image', {
        method: 'POST',
        body: { base64_image: base64Image }
      });

      onChange(res.url);
    } catch (e: any) {
      Alert.alert("Error Upload", e.message || "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  };

  const handlePick = async (useCamera: boolean) => {
    try {
      let permissionResult;
      if (useCamera) {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult.granted) {
        Alert.alert("Izin Ditolak", "Aplikasi membutuhkan izin untuk mengakses fitur ini.");
        return;
      }

      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1, // We will compress using manipulateAsync later
      };

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUpload(result.assets[0]);
      }
    } catch (e: any) {
      Alert.alert("Error", "Terjadi kesalahan saat membuka kamera/galeri");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors.text }]}>{label}</Text>
      
      {value ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: value }} style={styles.imagePreview} />
          <TouchableOpacity 
            style={styles.removeBtn}
            onPress={() => onChange('')}
          >
            <Ionicons name="close-circle" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.borderLight }]}
            onPress={() => handlePick(true)}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={20} color={Colors.primary} />
            <Text style={[styles.actionText, { color: Colors.primary }]}>Kamera</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: Colors.borderLight }]}
            onPress={() => handlePick(false)}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={20} color={Colors.primary} />
            <Text style={[styles.actionText, { color: Colors.primary }]}>Galeri</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={[styles.loadingText, { color: Colors.textTertiary }]}>Mengunggah...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 14,
  },
  imageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  }
});
