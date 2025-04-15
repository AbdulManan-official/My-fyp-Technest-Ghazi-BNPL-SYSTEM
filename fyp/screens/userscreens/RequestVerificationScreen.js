import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import Icon from "react-native-vector-icons/MaterialIcons";
import { uploadImage } from '../../Components/UploadImage';
import { useFocusEffect } from "@react-navigation/native";

const RequestVerificationScreen = ({ navigation }) => {
  const auth = getAuth();
  const db = getFirestore();

  const [images, setImages] = useState({ idFront: null, idBack: null, selfie: null });
  const [loading, setLoading] = useState(false);

  // 🔥 Clear images when the user leaves the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        setImages({ idFront: null, idBack: null, selfie: null });
        AsyncStorage.removeItem("verificationImages");
      };
    }, [])
  );

  // 📸 Handle image picking (Gallery or Camera)
  const openCameraOrGallery = async (type) => {
    Alert.alert(
      "Upload Image",
      "Choose an option",
      [
        { text: "Camera", onPress: () => pickImage(type, true) },
        { text: "Gallery", onPress: () => pickImage(type, false) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // 📸 Pick an image from the gallery or take a photo
  const pickImage = async (type, fromCamera) => {
    let result;
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
    }

    if (!result.canceled && result.assets.length > 0) {
      const imageUri = result.assets[0].uri;

      // 🔥 Store image locally but DO NOT upload yet
      const newImages = { ...images, [type]: imageUri };
      setImages(newImages);
      await AsyncStorage.setItem("verificationImages", JSON.stringify(newImages));
    }
  };

  // 📩 Handle form submission
  const handleSubmit = async () => {
    if (!images.idFront || !images.idBack || !images.selfie) {
      Alert.alert("Error", "Please select all required images before submitting.");
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "User not authenticated.");
        setLoading(false);
        return;
      }

      // 🔥 Upload images to Cloudinary when the request is submitted
      const cloudinaryUrls = {};
      for (const key in images) {
        if (images[key]) {
          const uploadResponse = await uploadImage({ uri: images[key] });
          cloudinaryUrls[key] = uploadResponse.cloudinaryUrl;
        }
      }

      const userRef = doc(db, "Users", user.uid);
      await setDoc(userRef, {
        verificationImages: cloudinaryUrls, // ✅ Save uploaded images to Firestore
        verificationStatus: "Pending",
      }, { merge: true });

      setLoading(false);

      // ✅ Show success alert only when the request is submitted
      Alert.alert("Success", "Your verification request has been submitted!");

      // After submission, go back to the UserProfileScreen with updated status
      navigation.goBack();

      // 🔥 Clear stored images after successful submission
      await AsyncStorage.removeItem("verificationImages");
      setImages({ idFront: null, idBack: null, selfie: null });

    } catch (error) {
      setLoading(false);
      Alert.alert("Error", "Something went wrong. Please try again.");
      console.error("Verification Upload Error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>Upload your government ID and a clear selfie</Text>

        <View style={styles.imageContainer}>
          {[ 
            { key: "idFront", label: "Front of ID", icon: "credit-card" },
            { key: "idBack", label: "Back of ID", icon: "credit-card" },
            { key: "selfie", label: "Your Selfie", icon: "account-circle" }
          ].map((item) => (
            <TouchableOpacity key={item.key} style={styles.imageBox} onPress={() => openCameraOrGallery(item.key)}>
              {images[item.key] ? (
                <Image source={{ uri: images[item.key] }} style={styles.image} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Icon name={item.icon} size={50} color="#FF4500" />
                  <Text style={styles.imageLabel}>{item.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (!images.idFront || !images.idBack || !images.selfie) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!images.idFront || !images.idBack || !images.selfie || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit for Verification</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  contentContainer: { alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#666", textAlign: "center", marginBottom: 20 },
  imageContainer: { flexDirection: "column", alignItems: "center", width: "100%" },
  imageBox: { width: 250, height: 250, backgroundColor: "#F0F0F0", justifyContent: "center", alignItems: "center", borderRadius: 15, overflow: 'hidden', marginBottom: 20 },
  placeholderContainer: { alignItems: "center" },
  imageLabel: { color: "#FF4500", fontSize: 16, marginTop: 5, textAlign: "center" },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  submitButton: { backgroundColor: "#FF4500", paddingVertical: 12, width: "80%", alignItems: "center", borderRadius: 25, marginTop: 20 },
  submitText: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  disabledButton: { backgroundColor: "#FFA07A" },
});

export default RequestVerificationScreen;
