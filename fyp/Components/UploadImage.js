import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

// Cloudinary API URL for Images and Videos
const cloudinaryBaseUrl = 'https://api.cloudinary.com/v1_1/ddwqefs9o';
const uploadPreset = 'technest'; // Cloudinary preset for unsigned upload

// Function to upload media (image/video) to Cloudinary
const uploadMediaToCloudinary = async (file, type) => {
  try {
    console.log(`📂 Uploading ${type} to Cloudinary...`, file.uri);

    let fileUri = file.uri;

    const fileType = fileUri.split('.').pop(); // Extract file type (e.g., 'jpg', 'png', 'mp4')
    let mimeType = getMimeType(type, fileType);

    // Prepare form data for Cloudinary upload
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri, // Pass the file URI directly here (either image or video)
      type: mimeType,
      name: `${type === 'video' ? 'video' : 'photo'}.${fileType}`,
    });
    formData.append('upload_preset', uploadPreset);

    // Select Cloudinary URL based on media type
    const cloudinaryUrl = `${cloudinaryBaseUrl}/${type}/upload`;

    const response = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
    const responseData = await response.json();

    if (responseData.error) {
      throw new Error(`Error uploading ${type}: ${responseData.error.message}`);
    }

    console.log(`✅ Cloudinary ${type.charAt(0).toUpperCase() + type.slice(1)} Upload Successful`);
    return responseData;
  } catch (error) {
    console.error(`❌ Error uploading ${type} to Cloudinary:`, error);
    throw error;
  }
};

// Get MIME type based on file type
const getMimeType = (type, fileType) => {
  if (type === 'image') {
    switch (fileType) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return `image/${fileType}`;
    }
  } else if (type === 'video') {
    switch (fileType) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      default:
        return `video/${fileType}`;
    }
  }
};

// Function to upload image to Cloudinary
export const uploadImage = async (image) => {
  try {
    console.log("🚀 Starting image upload to Cloudinary...");
    const cloudinaryResponse = await uploadMediaToCloudinary(image, 'image');
    return { cloudinaryUrl: cloudinaryResponse.secure_url };
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
};

// Function to upload video to Cloudinary (no separate handling needed)
export const uploadVideo = async (video) => {
  try {
    console.log("🚀 Starting video upload to Cloudinary...");

    // Upload video in the same way as an image
    const cloudinaryResponse = await uploadMediaToCloudinary(video, 'video');
    
    // If successful, return the video URL
    const videoUrl = cloudinaryResponse.secure_url;
    console.log("🌍 Cloudinary Video URL:", videoUrl);
    return { cloudinaryUrl: videoUrl };
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    throw error;
  }
};

// Function to pick image from gallery or take a picture using the camera
export const pickImageOrTakePicture = async (fromCamera = false) => {
  const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
  if (permissionResult.granted === false) {
    alert("Permission to access camera is required!");
    return;
  }

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

  if (!result.canceled && result.assets) {
    return result.assets[0];
  }
};

// Sample usage within a React component
export const handleChangePicture = async () => {
  Alert.alert("Change Profile Picture", "Choose an option", [
    { text: "Take Photo", onPress: async () => {
      const image = await pickImageOrTakePicture(true); // true to use camera
      if (image) await uploadImage(image);
    }},
    { text: "Choose from Gallery", onPress: async () => {
      const image = await pickImageOrTakePicture(); // false to pick from gallery
      if (image) await uploadImage(image);
    }},
    { text: "Cancel", style: "cancel" },
  ]);
};
