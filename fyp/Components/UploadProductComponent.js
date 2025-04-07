import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import { TextInput as PaperInput } from 'react-native-paper';
import * as FileSystem from 'expo-file-system';
import { uploadImage, uploadVideo } from './UploadImage';

const UploadProductComponent = ({ visible, onDismiss, onSave, categories, BNPLPlans, product }) => {
  const [productName, setProductName] = useState(product ? product.name : '');
  const [category, setCategory] = useState(product ? product.category : '');
  const [selectedPlans, setSelectedPlans] = useState(product ? product.BNPLPlan : []);
  const [description, setDescription] = useState(product ? product.description : '');
  const [originalPrice, setOriginalPrice] = useState(product ? product.originalPrice : '');
  const [discountedPrice, setDiscountedPrice] = useState(product ? product.discountedPrice : '');
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState({
    images: product ? product.media?.images : [],
    video: product ? product.media?.video : null,
  });
  const [paymentOption, setPaymentOption] = useState({ COD: true, BNPL: false });
  const [loadingBNPL, setLoadingBNPL] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (product) {
      setProductName(product.name);
      setCategory(product.category);
      setSelectedPlans(product.BNPLPlan || []);
      setDescription(product.description);
      setOriginalPrice(product.originalPrice);
      setDiscountedPrice(product.discountedPrice);
      setMedia({
        images: product.media?.images || [],
        video: product.media?.video || null,
      });
    }
    setLoading(false);
  }, [product]);

  const handleSubmit = async () => {
    if (!productName || !description || !originalPrice || !category || media.images.length === 0 || (!paymentOption.COD && !paymentOption.BNPL)) {
      Alert.alert('Error', 'Please fill all mandatory fields: Name, Description, Price, Category, and Payment Options with at least one image.');
      return;
    }
  
    setButtonLoading(true);
  
    const uploadedImages = [];
    for (let image of media.images) {
      try {
        const { cloudinaryUrl } = await uploadImage(image); // Upload image
        uploadedImages.push(cloudinaryUrl);
      } catch (error) {
        console.error('❌ Error uploading image:', error);
        Alert.alert('Error', 'Failed to upload images. Please try again.');
        setButtonLoading(false);
        return;
      }
    }
  
    let uploadedVideoUrl = null;
    if (media.video) {
      try {
        // Step 1: Upload the video to Cloudinary using base64
        const { cloudinaryUrl } = await uploadVideo({ uri: media.video });
  
        uploadedVideoUrl = cloudinaryUrl;
      } catch (error) {
        console.error('❌ Error uploading video:', error);
        Alert.alert('Error', 'Failed to upload video. Please try again.');
        setButtonLoading(false);
        return;
      }
    }
  
    const productData = {
      name: productName,
      category,
      description,
      originalPrice,
      discountedPrice,
      price: discountedPrice || originalPrice,
      media: { images: uploadedImages, video: uploadedVideoUrl },
      paymentOption,
      BNPLPlans: selectedPlans,
    };
  
    setTimeout(() => {
      setButtonLoading(false);
      onSave(productData);
    }, 3000);
  };
  
  
  const togglePlanSelection = (planId) => {
    setSelectedPlans((prevPlans) => {
      if (prevPlans.includes(planId)) {
        return prevPlans.filter((id) => id !== planId);
      } else {
        return [...prevPlans, planId];
      }
    });
  };

  const toggleSelectAllPlans = () => {
    if (selectAll) {
      setSelectedPlans([]);
    } else {
      setSelectedPlans(BNPLPlans.map((plan) => plan.id));
    }
    setSelectAll(!selectAll);
  };

  const pickMedia = async (type) => {
    let result;
    if (type === 'image') {
      Alert.alert("Choose Image", "Pick an option", [
        { text: "Use Camera", onPress: takePicture },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ]);
    } else if (type === 'video') {
      Alert.alert("Choose Video", "Pick an option", [
        { text: "Use Camera", onPress: takeVideo },
        { text: "Choose from Gallery", onPress: pickVideo },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });
      if (!result.canceled) {
        if (media.video && media.images.length + result.assets.length > 2) {
          Alert.alert('Error', 'You can only select a maximum of 2 images when a video is selected.');
          return;
        }
        if (!media.video && media.images.length + result.assets.length > 3) {
          Alert.alert('Error', 'You can only select a maximum of 3 images.');
          return;
        }
        setMedia((prevMedia) => {
          return { ...prevMedia, images: [...prevMedia.images, ...result.assets] };
        });
      }
    }
  };

  const takePicture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled) {
        if (media.video && media.images.length >= 2) {
          Alert.alert('Error', 'You can only select a maximum of 2 images when a video is selected.');
          return;
        }
        if (!media.video && media.images.length >= 3) {
          Alert.alert('Error', 'You can only select a maximum of 3 images.');
          return;
        }
        setMedia((prevMedia) => {
          return { ...prevMedia, images: [...prevMedia.images, result.assets[0]] };
        });
      }
    }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });
      if (!result.canceled) {
        if (media.video) {
          Alert.alert('Error', 'You can only select 1 video.');
          return;
        }
        setMedia((prevMedia) => {
          return { ...prevMedia, video: result.assets[0].uri }; // Assign the URI of the selected video
        });
      }
    }
  };
  

  const takeVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 1,
      });
      if (!result.canceled) {
        if (media.video) {
          Alert.alert('Error', 'You can only select 1 video.');
          return;
        }
        setMedia((prevMedia) => {
          return { ...prevMedia, video: result.assets[0].uri };
        });
      }
    }
  };

  const removeMedia = (index, type) => {
    if (type === 'image') {
      setMedia((prevMedia) => {
        const updatedImages = [...prevMedia.images];
        updatedImages.splice(index, 1);
        return { ...prevMedia, images: updatedImages };
      });
    } else if (type === 'video') {
      setMedia((prevMedia) => {
        return { ...prevMedia, video: null }; // Set video to null when removed
      });
    }
  };
  

  const handleImagePreview = (uri) => {
    setImagePreview(uri);
  };

  const handleVideoPreview = (uri) => {
    setVideoPreview(uri);
  };

  const closePreview = () => {
    setImagePreview(null);
    setVideoPreview(null);
  };

  const handlePaymentOptionChange = (option) => {
    setPaymentOption((prev) => ({ ...prev, [option]: !prev[option] }));

    if (option === 'BNPL' && !paymentOption.BNPL) {
      setLoadingBNPL(true);
      setTimeout(() => {
        setLoadingBNPL(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF0000" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
        <Icon name="close-circle" size={30} color="white" />
      </TouchableOpacity>

      <Text style={[styles.label, { color: 'black' }]}>Select Product Media</Text>

      <View style={styles.mediaPreviewContainer}>
        {media.images.map((img, index) => (
          <TouchableOpacity key={index} onPress={() => handleImagePreview(img.uri)}>
            <View style={styles.mediaPreview}>
              <Image source={{ uri: img.uri }} style={styles.mediaImage} />
              <TouchableOpacity onPress={() => removeMedia(index, 'image')} style={styles.removeMediaButton}>
                <Icon name="close-circle" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {media.video && (
          <TouchableOpacity onPress={() => handleVideoPreview(media.video)}>
            <View style={styles.mediaPreview}>
              <Video
                source={{ uri: media.video }}
                style={styles.mediaImage}
                useNativeControls
                resizeMode="contain"
                isLooping
              />
              <TouchableOpacity onPress={() => removeMedia(null, 'video')} style={styles.removeMediaButton}>
                <Icon name="close-circle" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={() => pickMedia('image')} style={styles.selectMediaButton}>
        <Text style={styles.selectMediaText}>Select Images (Max 3)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => pickMedia('video')} style={styles.selectMediaButton}>
        <Text style={styles.selectMediaText}>Select Video (Max 1)</Text>
      </TouchableOpacity>

      <PaperInput
        label="Product Name"
        value={productName}
        mode="outlined"
        onChangeText={setProductName}
        style={styles.input}
        outlineColor="black"
        activeOutlineColor="#FF0000"
      />

      <PaperInput
        label="Description"
        mode="outlined"
        value={description}
        onChangeText={setDescription}
        style={[styles.input, { height: 100 }]}
        outlineColor="black"
        activeOutlineColor="#FF0000"
        multiline
      />

      <PaperInput
        label="Original Price (PKR)"
        mode="outlined"
        value={originalPrice}
        onChangeText={setOriginalPrice}
        style={styles.input}
        keyboardType="numeric"
        outlineColor="black"
        activeOutlineColor="#FF0000"
      />

      <PaperInput
        label="Discounted Price (PKR) (Optional)"
        mode="outlined"
        value={discountedPrice}
        onChangeText={setDiscountedPrice}
        style={styles.input}
        keyboardType="numeric"
        outlineColor="black"
        activeOutlineColor="#FF0000"
      />

      <Text style={[styles.label, { color: 'black' }]}>Select Category</Text>
      <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
        <Picker.Item label="Select Category" value="" />
        {categories.map((cat) => (
          <Picker.Item key={cat.id} label={cat.categoryName} value={cat.id} />
        ))}
      </Picker>

      <Text style={[styles.label, { color: 'black' }]}>Select Payment Option</Text>
      <View style={styles.paymentOptions}>
        <TouchableOpacity
          onPress={() => handlePaymentOptionChange('COD')}
          style={[styles.paymentOptionButton, paymentOption.COD && styles.selectedPaymentOption]}
        >
          <Text style={[styles.paymentOptionText, paymentOption.COD && styles.selectedPaymentOptionText]}>
            {paymentOption.COD && <Icon name="check-circle" size={20} color="#FF0000" />}
            COD
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handlePaymentOptionChange('BNPL')}
          style={[styles.paymentOptionButton, paymentOption.BNPL && styles.selectedPaymentOption]}
        >
          <Text style={[styles.paymentOptionText, paymentOption.BNPL && styles.selectedPaymentOptionText]}>
            {paymentOption.BNPL && <Icon name="check-circle" size={20} color="#FF0000" />}
            BNPL
          </Text>
        </TouchableOpacity>
      </View>

      {paymentOption.BNPL && loadingBNPL ? (
        <ActivityIndicator size="large" color="#FF0000" />
      ) : (
        paymentOption.BNPL && (
          <>
            <Text style={[styles.label, { color: 'black' }]}>Select BNPL Plan(s)</Text>

            <View style={styles.checkboxContainer}>
              <TouchableOpacity onPress={toggleSelectAllPlans} style={styles.checkbox}>
                <View style={[styles.checkboxIcon, selectAll ? styles.checkedBox : null]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleSelectAllPlans}>
                <Text style={styles.selectAllPlansText}>
                  {selectAll ? 'Deselect All Plans' : 'Select All Plans'}
                </Text>
              </TouchableOpacity>
            </View>

            {BNPLPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planItem, selectedPlans.includes(plan.id) && styles.selectedPlan]}
                onPress={() => togglePlanSelection(plan.id)}
              >
                <View style={styles.checkbox}>
                  {selectedPlans.includes(plan.id) && <View style={styles.checkedBox} />}
                </View>
                <Text style={styles.planText}>{plan.planName}</Text>
                <Text style={styles.planType}>({plan.planType})</Text>
              </TouchableOpacity>
            ))}
          </>
        )
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onDismiss}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSubmit}
          disabled={buttonLoading}
        >
          {buttonLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Upload Product</Text>
          )}
        </TouchableOpacity>
      </View>

      {imagePreview && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={closePreview}>
          <View style={styles.modalContainer}>
            <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}>
              <Icon name="close-circle" size={40} color="white" />
            </TouchableOpacity>
            <Image source={{ uri: imagePreview }} style={styles.previewImage} />
          </View>
        </Modal>
      )}

      {videoPreview && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={closePreview}>
          <View style={styles.modalContainer}>
            <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}>
              <Icon name="close-circle" size={40} color="white" />
            </TouchableOpacity>
            <Video
              source={{ uri: videoPreview }}
              style={styles.previewVideo}
              useNativeControls
              resizeMode="contain"
              isLooping
            />
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 1,
    right: 1,
    backgroundColor: '#FF0000',
    padding: 4,
    borderRadius: 25,
    zIndex: 1,
  },
  input: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#f0f1f1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'black',
    marginBottom: 12,
    padding: 12,
    height: 60,
  },
  selectMediaButton: {
    backgroundColor: '#FF0000',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  selectMediaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mediaPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  mediaPreview: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  mediaImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 15,
    padding: 3,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 6,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  checkboxIcon: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  checkedBox: {
    width: 16,
    height: 16,
    backgroundColor: 'black',
    borderRadius: 3,
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  planText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  planType: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  selectAllPlansText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF0000',
  },
  paymentOptions: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  paymentOptionButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f1f1',
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  paymentOptionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
  },
  selectedPaymentOption: {
    borderWidth: 1,
    borderColor: 'black',
  },
  selectedPaymentOptionText: {
    color: '#FF0000',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF0000',
  },
  cancelButton: {
    backgroundColor: '#FF0000',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#FF0000',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
  previewImage: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
  previewVideo: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
});

export default UploadProductComponent;
