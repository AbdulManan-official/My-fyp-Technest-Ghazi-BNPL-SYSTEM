import * as FileSystem from 'expo-file-system';

// Cloudinary API URL for Images and Videos
const cloudinaryImageUrl = 'https://api.cloudinary.com/v1_1/ddwqefs9o/image/upload';
const cloudinaryVideoUrl = 'https://api.cloudinary.com/v1_1/ddwqefs9o/video/upload';
const uploadPreset = 'technest'; // Cloudinary preset for unsigned upload

// Function to upload to Cloudinary (Image or Video)
const uploadToCloudinary = async (file, type) => {
  try {
    console.log("📂 Uploading to Cloudinary:", file.uri);

    let fileUri = file.uri;

    // Handle video separately: If file is from the cache, copy it to a new location
    if (type === 'video' && fileUri.startsWith('file://')) {
      // Create a safe path in the document directory
      const newVideoUri = FileSystem.documentDirectory + fileUri.split('/').pop(); // Generate a safe path
      await FileSystem.copyAsync({
        from: fileUri,
        to: newVideoUri
      });
      fileUri = newVideoUri; // Update the file URI to the new one
      console.log('📝 Video copied to:', newVideoUri);
    }

    const fileType = fileUri.split('.').pop(); // Extract file type (e.g., 'jpg', 'png', 'jpeg', 'mp4')

    let mimeType = '';
    if (type === 'image') {
      if (fileType === 'jpg' || fileType === 'jpeg') mimeType = 'image/jpeg';
      else if (fileType === 'png') mimeType = 'image/png';
      else mimeType = `image/${fileType}`;
    } else if (type === 'video') {
      // Handle different video types
      if (fileType === 'mp4') mimeType = 'video/mp4';
      else if (fileType === 'mov') mimeType = 'video/quicktime';
      else mimeType = `video/${fileType}`;
    }

    // Prepare form data for Cloudinary upload
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: `${type === 'video' ? 'video' : 'photo'}.${fileType}`,
    });
    formData.append('upload_preset', uploadPreset);

    // Select Cloudinary URL based on media type
    const cloudinaryUrl = type === 'image' ? cloudinaryImageUrl : cloudinaryVideoUrl;

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

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

// Function to upload image to Cloudinary
export const uploadImage = async (image) => {
  try {
    console.log("🚀 Starting image upload to Cloudinary...");
    const cloudinaryResponse = await uploadToCloudinary(image, 'image');
    return { cloudinaryUrl: cloudinaryResponse.secure_url };
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
};

// Function to upload video to Cloudinary
export const uploadVideo = async (video) => {
  try {
    console.log("🚀 Starting video upload to Cloudinary...");
    const cloudinaryResponse = await uploadToCloudinary(video, 'video');
    const videoUrl = `https://res.cloudinary.com/ddwqefs9o/video/upload/${cloudinaryResponse.version}/${cloudinaryResponse.public_id}.${video.uri.split('.').pop()}`;
    console.log("🌍 Cloudinary Video URL:", videoUrl);
    return { cloudinaryUrl: videoUrl };
  } catch (error) {
    console.error('❌ Error uploading video:', error);
    throw error;
  }
};
