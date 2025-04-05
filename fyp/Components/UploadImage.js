import * as FileSystem from 'expo-file-system';

// Cloudinary API URL
const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/ddwqefs9o/video/upload';
const uploadPreset = 'technest'; // Preset for unsigned upload

// Function to upload an image to Cloudinary (with support for video)
const uploadToCloudinary = async (file) => {
  try {
    console.log("📂 Uploading to Cloudinary:", file.uri);

    // Get the file data from the selected media (video or image)
    const fileUri = file.uri;
    const fileType = fileUri.split('.').pop(); // Extract file type (e.g., 'mp4', 'mov', 'jpg', etc.)

    // Determine whether the file is an image or video
    const isVideo = fileType === 'mp4' || fileType === 'mov';

    // Form data for uploading
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: isVideo ? `video/${fileType}` : `image/${fileType}`, // Dynamically set the file type
      name: `media.${fileType}`, // Name the file based on its type (image/video)
    });
    formData.append('upload_preset', uploadPreset); // Using preset for unsigned uploads

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    const responseData = await response.json(); // Parse the response from Cloudinary

    if (responseData.error) {
      throw new Error(`Error uploading file: ${responseData.error.message}`);
    }

    console.log("✅ Cloudinary Upload Successful - Full Response:", responseData);
    console.log("🌍 Cloudinary Media URL:", responseData.secure_url); // Logging the media URL (image or video)

    return responseData; // Returning the full Cloudinary response
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Function to upload a video (or image) to Cloudinary
export const uploadMedia = async (file) => {
  try {
    console.log("🚀 Starting upload to Cloudinary...");

    const cloudinaryResponse = await uploadToCloudinary(file);

    console.log("✅ Upload Completed - Cloudinary URL:", cloudinaryResponse.secure_url);

    return {
      cloudinaryUrl: cloudinaryResponse.secure_url,
      cloudinaryData: cloudinaryResponse,
    };
  } catch (error) {
    console.error('❌ Error uploading media:', error);
    throw error;
  }
};
