import * as FileSystem from 'expo-file-system';

// Cloudinary API URL
const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/ddwqefs9o/image/upload';
const uploadPreset = 'technest';
// Function to upload an image to Cloudinary
const uploadToCloudinary = async (image) => {
  try {
    console.log("📂 Uploading to Cloudinary:", image.uri);

    // Get the file data from the image (without converting to base64)
    const fileUri = image.uri;
    const fileType = fileUri.split('.').pop(); // Extract file type (e.g., 'jpg', 'png')
    
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: `image/${fileType}`,
      name: `photo.${fileType}`, // Name the file based on its type
    }); // Append the image URI directly
    formData.append('upload_preset', uploadPreset); // Using preset for unsigned uploads

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    const responseData = await response.json(); // Parse the response from Cloudinary
    if (responseData.error) {
      throw new Error(`Error uploading image: ${responseData.error.message}`);
    }

    console.log("✅ Cloudinary Upload Successful - Full Response:", responseData);
    console.log("🌍 Cloudinary Image URL:", responseData.secure_url); // Logging only the image URL

    return responseData; // Returning the full Cloudinary response
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Function to upload an image to Cloudinary only
export const uploadImage = async (image) => {
  try {
    console.log("🚀 Starting upload to Cloudinary...");

    const cloudinaryResponse = await uploadToCloudinary(image);

    console.log("✅ Upload Completed - Cloudinary URL:", cloudinaryResponse.secure_url);

    return {
      cloudinaryUrl: cloudinaryResponse.secure_url,
      cloudinaryData: cloudinaryResponse,
    };
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    throw error;
  }
};
