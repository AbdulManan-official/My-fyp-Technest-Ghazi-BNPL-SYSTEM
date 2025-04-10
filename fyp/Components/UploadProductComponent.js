import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    Alert, Modal as PreviewModal, Image, Platform, Keyboard
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import { TextInput as PaperInput, HelperText, ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import PropTypes from 'prop-types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

import {
    uploadImage as uploadImageToCloudinary,
    uploadVideo as uploadVideoToCloudinary
} from './UploadImage';

const MEDIA_TYPES = { IMAGE: 'image', VIDEO: 'video' };
const PAYMENT_OPTIONS = { COD: 'COD', BNPL: 'BNPL' };
const MAX_IMAGES = 3;
const MAX_IMAGES_WITH_VIDEO = 2;
const MAX_VIDEOS = 1;

const UploadProductComponent = ({ visible, onDismiss, onSave, productForEdit }) => {

    const isEditMode = Boolean(productForEdit && productForEdit.id);
    const modeLogPrefix = isEditMode ? "UploadProductComponent (Edit):" : "UploadProductComponent (Add):";

    const [productName, setProductName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [originalPrice, setOriginalPrice] = useState('');
    const [discountedPrice, setDiscountedPrice] = useState('');
    const [media, setMedia] = useState({ images: [], video: null });
    const [paymentOption, setPaymentOption] = useState({ [PAYMENT_OPTIONS.COD]: true, [PAYMENT_OPTIONS.BNPL]: false });
    const [selectedPlans, setSelectedPlans] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [fetchedCategories, setFetchedCategories] = useState([]);
    const [loadingBNPL, setLoadingBNPL] = useState(false);
    const [fetchedBNPLPlans, setFetchedBNPLPlans] = useState([]);
    const [buttonLoading, setButtonLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const isMounted = useRef(true);
    const initialLoadDone = useRef(false);
    const prevProductForEditId = useRef(productForEdit?.id);


    useEffect(() => {
      isMounted.current = true;
      initialLoadDone.current = false;
      return () => { isMounted.current = false; }
    }, []);

    const fetchCategories = useCallback(async () => {
        if (!isMounted.current) return;
        setLoadingCategories(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'Category'));
            const categoriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (isMounted.current) {
               setFetchedCategories(categoriesData);
            }
        } catch (error) {
            console.error(`${modeLogPrefix} Error fetching categories: `, error);
            if (isMounted.current) Alert.alert("Error", "Could not fetch categories.");
        } finally {
            if (isMounted.current) setLoadingCategories(false);
        }
    }, [modeLogPrefix]);

    const fetchBNPLPlans = useCallback(async (initialSelectedPlanIds = []) => {
         if (!isMounted.current) return;
         setLoadingBNPL(true);
         setFetchedBNPLPlans([]);
         setSelectedPlans([]);
         setSelectAll(false);
        try {
            const querySnapshot = await getDocs(collection(db, 'BNPL_plans'));
            const plansData = querySnapshot.docs
                                  .map(doc => ({ id: doc.id, ...doc.data() }))
                                  .filter(plan => plan.status === 'Published');

            if (isMounted.current) {
                setFetchedBNPLPlans(plansData);

                if (isEditMode && initialSelectedPlanIds.length > 0 && plansData.length > 0) {
                    const validInitialPlans = initialSelectedPlanIds.filter(id => plansData.some(p => p.id === id));
                     if (validInitialPlans.length !== initialSelectedPlanIds.length) {
                         console.warn(`${modeLogPrefix} Some initial BNPL plans were not found or were not 'Published'.`);
                     }
                     setSelectedPlans(validInitialPlans);
                     setSelectAll(plansData.length > 0 && validInitialPlans.length === plansData.length);
                } else {
                    setSelectedPlans([]);
                    setSelectAll(false);
                }
            }
        } catch (error) {
            console.error(`${modeLogPrefix} Error fetching BNPL plans: `, error);
            if (isMounted.current) {
               Alert.alert("Error", "Could not fetch BNPL plans.");
               setFetchedBNPLPlans([]);
               setSelectedPlans([]);
               setSelectAll(false);
            }
        } finally {
            if (isMounted.current) setLoadingBNPL(false);
        }
    }, [modeLogPrefix, isEditMode]);

    useEffect(() => {
        if (visible && (!initialLoadDone.current || (productForEdit?.id !== prevProductForEditId.current))) {

            setFormErrors({});
            setSubmitAttempted(false);
            setButtonLoading(false);

            if (fetchedCategories.length === 0) {
                 fetchCategories();
            }

            if (isEditMode && productForEdit) {
                setProductName(productForEdit.name || '');
                setCategory(productForEdit.category || '');
                setDescription(productForEdit.description || '');
                setOriginalPrice(productForEdit.originalPrice?.toString() || '');
                setDiscountedPrice(productForEdit.discountedPrice?.toString() || '');

                const existingImages = (productForEdit.media?.images || [])
                                        .filter(url => typeof url === 'string' && url.trim() !== '')
                                        .map(url => ({ uri: url, isUploaded: true }));
                const existingVideoData = productForEdit.media?.video;
                const existingVideo = (existingVideoData && typeof existingVideoData === 'string' && existingVideoData.trim() !== '')
                                       ? { uri: existingVideoData, isUploaded: true } : null;
                setMedia({ images: existingImages, video: existingVideo });

                const initialPaymentOptions = {
                   COD: productForEdit.paymentOption?.COD ?? (!productForEdit.paymentOption?.BNPL),
                   BNPL: productForEdit.paymentOption?.BNPL ?? false,
                };
                setPaymentOption(initialPaymentOptions);

                if (initialPaymentOptions.BNPL) {
                    const initialBNPLPlanIds = Array.isArray(productForEdit.BNPLPlans) ? productForEdit.BNPLPlans : [];
                     if (fetchedBNPLPlans.length === 0) {
                         fetchBNPLPlans(initialBNPLPlanIds);
                     } else {
                         const validInitialPlans = initialBNPLPlanIds.filter(id => fetchedBNPLPlans.some(p => p.id === id));
                          setSelectedPlans(validInitialPlans);
                          setSelectAll(fetchedBNPLPlans.length > 0 && validInitialPlans.length === fetchedBNPLPlans.length);
                     }
                } else {
                    setSelectedPlans([]);
                    setSelectAll(false);
                    setLoadingBNPL(false);
                    setFetchedBNPLPlans([]);
                }

            } else {
                setProductName('');
                setCategory('');
                setDescription('');
                setOriginalPrice('');
                setDiscountedPrice('');
                setMedia({ images: [], video: null });
                setPaymentOption({ COD: true, BNPL: false });
                setSelectedPlans([]);
                setSelectAll(false);
                setLoadingBNPL(false);
                setFetchedBNPLPlans([]);
            }
             initialLoadDone.current = true;
             prevProductForEditId.current = productForEdit?.id;
        } else if (!visible) {
            initialLoadDone.current = false;
            prevProductForEditId.current = null;
        }
    }, [visible, productForEdit, isEditMode, fetchCategories, fetchBNPLPlans, fetchedCategories.length]);


    useEffect(() => {
        prevProductForEditId.current = productForEdit?.id;
    });


   const handlePaymentOptionChange = useCallback(async (option) => {
       const currentOptionState = paymentOption[option];
       const newPaymentOptions = { ...paymentOption, [option]: !currentOptionState };

       if (!newPaymentOptions.COD && !newPaymentOptions.BNPL) {
           Alert.alert("Selection Required", "At least one payment option (COD or BNPL) must be selected.");
           return;
       }

       setPaymentOption(newPaymentOptions);

       if (submitAttempted) {
           setFormErrors(prev => ({ ...prev, paymentOption: null }));
       }

       if (option === PAYMENT_OPTIONS.BNPL) {
           if (!currentOptionState) {
               const plansToPreserve = isEditMode ? (productForEdit?.BNPLPlans || []) : [];
               if (fetchedBNPLPlans.length === 0) {
                   fetchBNPLPlans(plansToPreserve);
               } else if(isEditMode) {
                 const validInitialPlans = (productForEdit?.BNPLPlans || []).filter(id => fetchedBNPLPlans.some(p => p.id === id));
                 setSelectedPlans(validInitialPlans);
                 setSelectAll(fetchedBNPLPlans.length > 0 && validInitialPlans.length === fetchedBNPLPlans.length);
               } else {
                 setSelectedPlans([]);
                 setSelectAll(false);
               }
           } else {
               setSelectedPlans([]);
               setSelectAll(false);
               setLoadingBNPL(false);
               // setFetchedBNPLPlans([]);
               if (submitAttempted) {
                   setFormErrors(prev => ({ ...prev, bnplPlans: null }));
               }
           }
       }
   }, [paymentOption, submitAttempted, fetchBNPLPlans, isEditMode, productForEdit?.BNPLPlans, fetchedBNPLPlans]);

    const validateForm = useCallback((showErrors = true) => {
        const errors = {};
        if (!productName.trim()) errors.productName = 'Product Name is required.';
        if (!description.trim()) errors.description = 'Description is required.';
        if (!category) errors.category = 'Category is required.';

        const origPriceNum = Number(originalPrice);
        const discPriceNum = discountedPrice.trim() ? Number(discountedPrice) : NaN;

        if (!originalPrice.trim()) {
            errors.originalPrice = 'Original Price is required.';
        } else if (isNaN(origPriceNum) || origPriceNum <= 0) {
            errors.originalPrice = 'Original Price must be a positive number.';
        }

        if (discountedPrice.trim()) {
           if (isNaN(discPriceNum) || discPriceNum < 0) {
              errors.discountedPrice = 'Discounted Price must be a non-negative number.';
           } else if (!isNaN(origPriceNum) && origPriceNum > 0 && discPriceNum >= origPriceNum) {
              errors.discountedPrice = 'Discounted Price must be less than Original Price.';
           }
        }

        const hasImages = media.images.length > 0;
        if (!hasImages) errors.media = 'At least one image is required.';

        if (paymentOption.BNPL && !loadingBNPL) {
            if (fetchedBNPLPlans.length === 0) {
                 console.warn(modeLogPrefix, "Validation Check: BNPL selected but no plans available/loaded.");
            } else if (selectedPlans.length === 0) {
                 errors.bnplPlans = 'Please select at least one BNPL plan.';
            }
        }

        if (showErrors) {
          setFormErrors(errors);
        }
        const isValid = Object.keys(errors).length === 0;
        return isValid;
    }, [
        productName, description, category, originalPrice, discountedPrice,
        media.images.length, paymentOption.BNPL, selectedPlans.length,
        loadingBNPL, fetchedBNPLPlans.length, modeLogPrefix
    ]);

    const handleInputChange = useCallback((setter, fieldName) => (value) => {
        setter(value);
        if (submitAttempted) {
            setFormErrors(prev => ({ ...prev, [fieldName]: null }));
            if (fieldName === 'originalPrice' || fieldName === 'discountedPrice') {
                 const currentErrors = validateForm(false);
                 setFormErrors(prev => ({
                    ...prev,
                    originalPrice: fieldName === 'originalPrice' ? currentErrors.originalPrice || null : prev.originalPrice,
                    discountedPrice: currentErrors.discountedPrice || null
                }));
            }
        }
    }, [submitAttempted, validateForm]);

    const togglePlanSelection = useCallback((planId) => {
        setSelectedPlans((prevPlans) => {
            const newSelectedPlans = prevPlans.includes(planId)
                ? prevPlans.filter((id) => id !== planId)
                : [...prevPlans, planId];

            setSelectAll(fetchedBNPLPlans.length > 0 && newSelectedPlans.length === fetchedBNPLPlans.length);

            if (submitAttempted && paymentOption.BNPL) {
                 setFormErrors(prev => ({ ...prev, bnplPlans: newSelectedPlans.length === 0 && fetchedBNPLPlans.length > 0 ? 'Please select at least one BNPL plan.' : null }));
            }
            return newSelectedPlans;
        });
    }, [submitAttempted, paymentOption.BNPL, fetchedBNPLPlans.length]);

     const toggleSelectAllPlans = useCallback(() => {
        const newSelectAllState = !selectAll;
        let newSelectedPlans = [];
        if (newSelectAllState && fetchedBNPLPlans.length > 0) {
            newSelectedPlans = fetchedBNPLPlans.map((plan) => plan.id);
        }

        setSelectedPlans(newSelectedPlans);
        setSelectAll(newSelectAllState);

        if (submitAttempted && paymentOption.BNPL) {
           setFormErrors(prev => ({ ...prev, bnplPlans: newSelectedPlans.length === 0 && fetchedBNPLPlans.length > 0 ? 'Please select at least one BNPL plan.' : null }));
        }
    }, [selectAll, fetchedBNPLPlans, submitAttempted, paymentOption.BNPL]);

    const checkMediaLimits = useCallback((type, count = 1) => {
        const currentImages = media.images.length;
        const hasVideo = !!media.video;

        if (type === MEDIA_TYPES.IMAGE) {
            const limit = hasVideo ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES;
            if (currentImages + count > limit) {
                Alert.alert('Limit Reached', `You can select a maximum of ${limit} images${hasVideo ? ' when a video is also selected' : ''}.`);
                return false;
            }
        } else if (type === MEDIA_TYPES.VIDEO) {
            if (count > 0 && hasVideo) {
                Alert.alert('Limit Reached', `You can only select ${MAX_VIDEOS} video.`);
                return false;
            }
            if (count > 0 && currentImages > MAX_IMAGES_WITH_VIDEO) {
                Alert.alert('Image Limit Exceeded', `Cannot add video. You have ${currentImages} images (max ${MAX_IMAGES_WITH_VIDEO} allowed with video). Please remove ${currentImages - MAX_IMAGES_WITH_VIDEO} image(s) first.`);
                return false;
            }
        }
        return true;
    }, [media.images.length, media.video]);

    const requestPermissions = useCallback(async (permissionType) => {
        let permissionResult;
        try {
            if (permissionType === 'camera') {
                permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            } else {
                permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            }
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', `Permission to access the ${permissionType === 'camera' ? 'camera' : 'media library'} is required. Please grant permission in your device settings.`, [{ text: 'OK' }]);
                return false;
            }
            return true;
        } catch (error) {
             console.error(`${modeLogPrefix} Error requesting ${permissionType} permissions:`, error);
             Alert.alert('Permission Error', `Could not request ${permissionType} permissions. Please check your app settings.`);
             return false;
        }
    }, [modeLogPrefix]);

     const pickMediaFromLibrary = useCallback(async (type) => {
       if (!(await requestPermissions('library'))) return;

        const isImage = type === MEDIA_TYPES.IMAGE;
        const mediaTypesOption = isImage ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos;

        const currentImages = media.images.length;
        const hasVideo = !!media.video;
        const imageLimit = hasVideo ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES;
        const remainingImageSlots = Math.max(0, imageLimit - currentImages);
        const canAddVideo = !hasVideo && currentImages <= MAX_IMAGES_WITH_VIDEO;

        const selectionLimit = isImage ? remainingImageSlots : (canAddVideo ? 1 : 0);

        if (selectionLimit <= 0) {
            Alert.alert('Limit Reached', `Cannot add more ${type}s based on current selections and limits.`);
            return;
        }

        try {
          const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: mediaTypesOption,
              allowsMultipleSelection: isImage,
              selectionLimit: selectionLimit,
              quality: isImage ? 0.8 : 1
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
             return;
          }

          let addedCount = 0;
          if (isImage) {
              const validNewImages = result.assets
                  .filter(asset => asset?.uri && typeof asset.uri === 'string')
                  .map(asset => ({ uri: asset.uri, isUploaded: false }));

              if (validNewImages.length > 0) {
                 addedCount = validNewImages.length;
                 setMedia(prevMedia => ({ ...prevMedia, images: [...prevMedia.images, ...validNewImages] }));
              }
              if (validNewImages.length !== result.assets.length) {
                  Alert.alert("Selection Info", `Processed ${validNewImages.length} out of ${result.assets.length} selected items. Some might have been invalid or exceeded limits.`);
              }

          } else {
              const videoAsset = result.assets[0];
              if (videoAsset?.uri && typeof videoAsset.uri === 'string') {
                 if (checkMediaLimits(MEDIA_TYPES.VIDEO, 1)) {
                     addedCount = 1;
                     setMedia(prevMedia => ({ ...prevMedia, video: { uri: videoAsset.uri, isUploaded: false } }));
                 } else {
                     console.warn(modeLogPrefix, "Video addition blocked by checkMediaLimits after selection.");
                 }
              } else {
                 Alert.alert("Invalid Video", "The selected video file could not be processed (missing URI).");
              }
          }

          if (addedCount > 0 && submitAttempted) {
             setFormErrors(prev => ({ ...prev, media: null }));
          }

        } catch (error) {
             console.error(`${modeLogPrefix} Error picking media:`, error);
             Alert.alert('Error', 'Could not open media library. Please try again.');
        }
    }, [media.images.length, media.video, submitAttempted, requestPermissions, checkMediaLimits, modeLogPrefix]);

     const captureMediaWithCamera = useCallback(async (type) => {
      if (!(await requestPermissions('camera'))) return;
      const isImage = type === MEDIA_TYPES.IMAGE;
      const mediaTypesOption = isImage ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos;

      if (!checkMediaLimits(type, 1)) return;

      try {
          const result = await ImagePicker.launchCameraAsync({
              mediaTypes: mediaTypesOption,
              allowsEditing: false,
              quality: isImage ? 0.8 : 1
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
            return;
          }

          const asset = result.assets[0];
          let added = false;
           if (asset?.uri && typeof asset.uri === 'string') {
              if (isImage) {
                  if (checkMediaLimits(MEDIA_TYPES.IMAGE, 1)) {
                       setMedia(prevMedia => ({ ...prevMedia, images: [...prevMedia.images, { uri: asset.uri, isUploaded: false }] }));
                       added = true;
                  }
              } else {
                  if (checkMediaLimits(MEDIA_TYPES.VIDEO, 1)) {
                       setMedia(prevMedia => ({ ...prevMedia, video: { uri: asset.uri, isUploaded: false } }));
                       added = true;
                  }
              }

              if (added) {
                  if (submitAttempted) { setFormErrors(prev => ({ ...prev, media: null })); }
              } else {
                  Alert.alert("Limit Reached", `Could not add the captured ${type} due to media limits possibly changing.`);
              }
          } else { Alert.alert("Capture Error", "The captured media could not be processed (missing URI)."); }

      } catch (error) {
          console.error(`${modeLogPrefix} Error capturing media:`, error);
          Alert.alert('Error', 'Could not open camera. Please try again.');
      }
    }, [media.images.length, media.video, submitAttempted, requestPermissions, checkMediaLimits, modeLogPrefix]);

     const removeMedia = useCallback((indexOrType, type) => {
        const isImage = type === MEDIA_TYPES.IMAGE;
        const itemToRemove = isImage ? media.images[indexOrType] : media.video;

        if (!itemToRemove) {
             console.warn(`${modeLogPrefix} Attempted to remove non-existent media (type: ${type}, index/type: ${indexOrType}).`);
             return;
        }

        const mediaIdentifier = isImage ? `image` : 'video';

        Alert.alert(
           "Remove Media", `Are you sure you want to remove this ${mediaIdentifier}?${itemToRemove.isUploaded ? '\n(Note: This was previously uploaded)' : ''}`,
           [
               { text: "Cancel", style: "cancel" },
               { text: "Remove", style: "destructive", onPress: () => {
                       setMedia(prevMedia => {
                            let updatedImages = [...prevMedia.images];
                            let updatedVideo = prevMedia.video;

                            if (isImage) {
                                if (indexOrType >= 0 && indexOrType < updatedImages.length) {
                                   updatedImages.splice(indexOrType, 1);
                                } else {
                                    console.warn(`${modeLogPrefix} Invalid index for image removal: ${indexOrType}`);
                                    return prevMedia;
                                }
                            } else {
                                updatedVideo = null;
                            }

                            if (submitAttempted) {
                                 setFormErrors(prevErr => ({ ...prevErr, media: updatedImages.length > 0 ? null : 'At least one image is required.' }));
                            }

                            return { images: updatedImages, video: updatedVideo };
                       });
                   }
               }
           ]
       );
    }, [media.images, media.video, submitAttempted, modeLogPrefix]);

     const showMediaSourceOptions = useCallback((type) => {
        const title = type === MEDIA_TYPES.IMAGE ? "Select Image Source" : "Select Video Source";
        const options = [
            { text: "Choose from Gallery", onPress: () => pickMediaFromLibrary(type) },
            ...(Platform.OS !== 'web' ? [{ text: "Use Camera", onPress: () => captureMediaWithCamera(type) }] : []),
            { text: "Cancel", style: "cancel" },
        ];
        Alert.alert(title, "", options);
    }, [pickMediaFromLibrary, captureMediaWithCamera]);

     const handleImagePreview = useCallback((uri) => { if (uri && typeof uri === 'string') setImagePreview(uri); }, []);
     const handleVideoPreview = useCallback((uri) => { if (uri && typeof uri === 'string') setVideoPreview(uri); }, []);
     const closePreview = useCallback(() => { setImagePreview(null); setVideoPreview(null); }, []);


    const handleSubmit = useCallback(async () => {
        Keyboard.dismiss();
        setSubmitAttempted(true);

        if (!validateForm(true)) {
            Alert.alert('Validation Error', 'Please review the form and fix the indicated errors.');
            return;
        }

        if (typeof onSave !== 'function') {
            console.error(`${modeLogPrefix} onSave prop is missing or not a function! Cannot submit.`);
            Alert.alert('Configuration Error', 'Cannot save product. Please contact support.');
            return;
        }

        setButtonLoading(true);
        setFormErrors({});

        try {
            const newImagesToUpload = media.images.filter(img => !img.isUploaded);
            const newVideoToUpload = media.video && !media.video.isUploaded ? media.video : null;

            const existingImageUrls = media.images.filter(img => img.isUploaded).map(img => img.uri);
            const existingVideoUrl = media.video && media.video.isUploaded ? media.video.uri : null;

            let uploadedNewImageUrls = [];
            let uploadedNewVideoUrl = null;

            if (newImagesToUpload.length > 0) {
                const uploadImagePromises = newImagesToUpload.map(image =>
                    uploadImageToCloudinary({ uri: image.uri })
                );
                const uploadedImageResults = await Promise.allSettled(uploadImagePromises);

                uploadedImageResults.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value?.cloudinaryUrl) {
                        uploadedNewImageUrls.push(result.value.cloudinaryUrl);
                    } else {
                        const originalUri = newImagesToUpload[index]?.uri.slice(-20);
                        const errorReason = result.reason instanceof Error ? result.reason.message : JSON.stringify(result.reason);
                        console.error(`${modeLogPrefix} New image upload failed (URI ending: ...${originalUri}): ${errorReason}`);
                        throw new Error(`An image upload failed. Please check connection and try again.`);
                    }
                });
            }

            if (newVideoToUpload) {
                try {
                    const videoResult = await uploadVideoToCloudinary({ uri: newVideoToUpload.uri });
                    if (videoResult?.cloudinaryUrl) {
                        uploadedNewVideoUrl = videoResult.cloudinaryUrl;
                    } else {
                        throw new Error("Video upload function did not return a valid URL.");
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown video upload error";
                    console.error(`${modeLogPrefix} New video upload failed: ${errorMessage}`);
                    throw new Error(`Video upload failed: ${errorMessage}. Please try again.`);
                }
            }

            const finalImageUrls = [...existingImageUrls, ...uploadedNewImageUrls];
            const finalVideoUrl = uploadedNewVideoUrl || existingVideoUrl;

            const origPrice = Number(originalPrice);
            const discPriceRaw = discountedPrice.trim();
            const discPriceNum = discPriceRaw ? Number(discPriceRaw) : null;

            const finalDiscountedPrice = (discPriceNum !== null && !isNaN(discPriceNum) && discPriceNum >= 0 && discPriceNum < origPrice)
                                        ? discPriceNum
                                        : null;

            const finalPrice = finalDiscountedPrice !== null ? finalDiscountedPrice : origPrice;

            const productData = {
                name: productName.trim(),
                category: category,
                description: description.trim(),
                originalPrice: origPrice,
                discountedPrice: finalDiscountedPrice,
                price: finalPrice,
                media: {
                    images: finalImageUrls,
                    video: finalVideoUrl
                },
                paymentOption: paymentOption,
                BNPLPlans: paymentOption.BNPL ? selectedPlans : [],
            };

            await onSave(productData);

        } catch (error) {
            console.error(`${modeLogPrefix} Product ${isEditMode ? 'update' : 'creation'} failed during handleSubmit:`, error);
            const displayMessage = `Failed to ${isEditMode ? 'update' : 'save'} product: ${error.message || 'An unexpected error occurred. Please try again.'}`;
            setFormErrors({ submit: displayMessage });
            Alert.alert('Save Error', displayMessage);
        } finally {
            if (isMounted.current) {
               setButtonLoading(false);
            }
        }
    }, [
        isEditMode,
        productName, category, description, originalPrice, discountedPrice,
        media, paymentOption, selectedPlans,
        validateForm, onSave,
        modeLogPrefix
    ]);


     const renderFieldError = (fieldName) => {
       if (formErrors[fieldName]) {
         return <HelperText type="error" visible={true} style={styles.errorTextAbove}>
                   {formErrors[fieldName]}
                </HelperText>;
       }
       return null;
     };

     const imageLimit = media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES;
     const isImageLimitReached = media.images.length >= imageLimit;
     const isVideoLimitReached = !!media.video;
     const canAddVideo = !isVideoLimitReached && media.images.length <= MAX_IMAGES_WITH_VIDEO;
     const canAddImage = !isImageLimitReached;

    return (
        <View style={styles.componentRoot}>
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.headerRow}>
                    <Text style={styles.modalTitle}>{isEditMode ? 'Edit Product' : 'Add New Product'}</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={onDismiss} disabled={buttonLoading}>
                        <Icon name="close-circle" size={30} color="white" />
                    </TouchableOpacity>
                </View>

                {renderFieldError('submit')}

                 <Text style={styles.label}>Product Media</Text>
                 {renderFieldError('media')}
                 <View style={styles.mediaPreviewContainer}>
                     {media.images.map((img, index) => (
                         <TouchableOpacity key={`${index}-${img.uri.slice(-10)}`} onPress={() => handleImagePreview(img.uri)} disabled={buttonLoading} style={styles.mediaPreviewWrapper} activeOpacity={0.7} >
                             <View style={styles.mediaPreview}>
                                 <Image source={{ uri: img.uri }} style={styles.mediaImage} onError={(e) => console.warn(`${modeLogPrefix} Image load error for URI ${img.uri.slice(-10)}:`, e.nativeEvent.error)} />
                                 {!img.isUploaded && ( <View style={[styles.uploadIndicator, styles.newIndicator]}><Text style={styles.uploadIndicatorText}>New</Text></View> )}
                                 {img.isUploaded && ( <View style={[styles.uploadIndicator, styles.uploadedIndicator]}><Icon name="cloud-check-outline" size={12} color="#fff"/></View> )}
                                 <TouchableOpacity onPress={() => removeMedia(index, MEDIA_TYPES.IMAGE)} style={styles.removeMediaButton} disabled={buttonLoading} >
                                     <Icon name="close-circle" size={22} color="#fff" />
                                 </TouchableOpacity>
                             </View>
                         </TouchableOpacity>
                     ))}
                     {media.video && (
                         <TouchableOpacity key={media.video.uri.slice(-10)} onPress={() => handleVideoPreview(media.video.uri)} disabled={buttonLoading} style={styles.mediaPreviewWrapper} activeOpacity={0.7} >
                             <View style={styles.mediaPreview}>
                                 <View style={styles.mediaVideoPlaceholder}><Icon name="play-circle-outline" size={40} color="#FFF" /></View>
                                 {!media.video.isUploaded && ( <View style={[styles.uploadIndicator, styles.newIndicator]}><Text style={styles.uploadIndicatorText}>New</Text></View> )}
                                 {media.video.isUploaded && ( <View style={[styles.uploadIndicator, styles.uploadedIndicator]}><Icon name="cloud-check-outline" size={12} color="#fff"/></View> )}
                                 <TouchableOpacity onPress={() => removeMedia(null, MEDIA_TYPES.VIDEO)} style={styles.removeMediaButton} disabled={buttonLoading} >
                                     <Icon name="close-circle" size={22} color="#fff" />
                                 </TouchableOpacity>
                             </View>
                         </TouchableOpacity>
                     )}
                 </View>

                 <View style={styles.mediaButtonContainer}>
                     <TouchableOpacity onPress={() => showMediaSourceOptions(MEDIA_TYPES.IMAGE)} style={[styles.selectMediaButton, (!canAddImage || buttonLoading) && styles.disabledOpacity]} disabled={!canAddImage || buttonLoading} >
                         <Icon name="image-plus" size={20} color="#fff" style={styles.buttonIcon} />
                         <Text style={styles.selectMediaText}>Add Image ({media.images.length}/{imageLimit})</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => showMediaSourceOptions(MEDIA_TYPES.VIDEO)} style={[styles.selectMediaButton, (!canAddVideo || buttonLoading) && styles.disabledOpacity]} disabled={!canAddVideo || buttonLoading} >
                         <Icon name="video-plus" size={20} color="#fff" style={styles.buttonIcon} />
                         <Text style={styles.selectMediaText}>{isVideoLimitReached ? 'Video Added' : 'Add Video'}</Text>
                     </TouchableOpacity>
                 </View>
                 {media.images.length > MAX_IMAGES_WITH_VIDEO && !media.video && ( <Text style={styles.warningText}>Remove images to add a video (max {MAX_IMAGES_WITH_VIDEO} images with video).</Text> )}
                 <Text style={styles.mediaHint}>Max {MAX_IMAGES} images OR {MAX_IMAGES_WITH_VIDEO} images + {MAX_VIDEOS} video.</Text>


                {renderFieldError('productName')}
                <PaperInput label="Product Name" value={productName} mode="outlined" onChangeText={handleInputChange(setProductName, 'productName')} outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.productName} disabled={buttonLoading} style={styles.inputField} />

                {renderFieldError('description')}
                <PaperInput label="Description" mode="outlined" value={description} onChangeText={handleInputChange(setDescription, 'description')} outlineColor="grey" activeOutlineColor="#FF0000" multiline={true} numberOfLines={4} error={!!formErrors.description} disabled={buttonLoading} style={[styles.inputField, styles.descriptionInput]} />

                {renderFieldError('originalPrice')}
                <PaperInput label="Original Price (PKR)" mode="outlined" value={originalPrice} onChangeText={handleInputChange(setOriginalPrice, 'originalPrice')} keyboardType="numeric" outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.originalPrice} disabled={buttonLoading} style={styles.inputField} />

                {renderFieldError('discountedPrice')}
                <PaperInput label="Discounted Price (PKR) (Optional)" mode="outlined" value={discountedPrice} onChangeText={handleInputChange(setDiscountedPrice, 'discountedPrice')} keyboardType="numeric" outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.discountedPrice} disabled={buttonLoading} style={styles.inputField} />
                {discountedPrice.trim() && Number(discountedPrice) >= Number(originalPrice) && !formErrors.discountedPrice && (
                     <HelperText type="info" visible={true} style={styles.infoText}>Discounted price must be lower than original price to apply.</HelperText>
                 )}

                <Text style={styles.label}>Category</Text>
                {loadingCategories && <ActivityIndicator size="small" color="#FF0000" style={styles.inlineLoader} />}
                {renderFieldError('category')}
                 <View style={[ styles.pickerContainer, !!formErrors.category && styles.pickerErrorBorder ]}>
                     <Picker
                        selectedValue={category}
                        style={styles.picker}
                        onValueChange={(itemValue) => {
                            if (itemValue !== category) {
                                setCategory(itemValue);
                                if (submitAttempted) {
                                    setFormErrors(prev => ({ ...prev, category: itemValue ? null : 'Category is required.' }));
                                }
                            }
                        }}
                        enabled={!loadingCategories && !buttonLoading && fetchedCategories.length > 0}
                        dropdownIconColor="#555"
                        mode="dropdown"
                        prompt="Select a Category"
                     >
                         <Picker.Item label="-- Select Category --" value="" style={styles.pickerPlaceholder} enabled={false} />
                         {fetchedCategories.map((cat) => (
                            <Picker.Item key={cat.id} label={cat.categoryName || `Unnamed (${cat.id.substring(0,4)})`} value={cat.id} />
                         ))}
                     </Picker>
                 </View>
                 {!loadingCategories && fetchedCategories.length === 0 && visible && (
                    <Text style={styles.warningText}>No categories found or failed to load. Cannot select category.</Text>
                 )}

                 <Text style={styles.label}>Payment Options</Text>
                 {renderFieldError('paymentOption')}
                 <View style={styles.paymentOptions}>
                     <TouchableOpacity onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.COD)} style={[ styles.paymentOptionButton, paymentOption.COD && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity ]} disabled={buttonLoading} >
                         <Icon name={paymentOption.COD ? "check-circle" : "circle-outline"} size={20} color={paymentOption.COD ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                         <Text style={[styles.paymentOptionText, paymentOption.COD && styles.selectedPaymentOptionText]}> COD </Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL)} style={[ styles.paymentOptionButton, paymentOption.BNPL && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity ]} disabled={buttonLoading} >
                        <Icon name={paymentOption.BNPL ? "check-circle" : "circle-outline"} size={20} color={paymentOption.BNPL ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                         <Text style={[styles.paymentOptionText, paymentOption.BNPL && styles.selectedPaymentOptionText]}> BNPL </Text>
                     </TouchableOpacity>
                 </View>

                 {paymentOption.BNPL && (
                      <>
                       {loadingBNPL && ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF0000" /><Text style={styles.loadingText}>Loading BNPL Plans...</Text></View> )}
                       {!loadingBNPL && fetchedBNPLPlans.length > 0 && (
                          <>
                               <Text style={styles.label}>Available BNPL Plan(s)</Text>
                               {renderFieldError('bnplPlans')}
                               <View style={[styles.bnplListContainer, !!formErrors.bnplPlans && styles.bnplContainerErrorBorder]}>
                                   <TouchableOpacity onPress={toggleSelectAllPlans} style={[styles.planItem, styles.selectAllContainer, (buttonLoading || fetchedBNPLPlans.length === 0) && styles.disabledOpacity]} disabled={buttonLoading || fetchedBNPLPlans.length === 0} >
                                       <View style={styles.checkbox}><Icon name={selectAll ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectAll ? '#FF0000' : '#555'} /></View>
                                       <Text style={styles.selectAllPlansText}> {selectAll ? 'Deselect All Plans' : 'Select All Plans'} </Text>
                                   </TouchableOpacity>
                                  {fetchedBNPLPlans.map((plan) => (
                                      <TouchableOpacity
                                         key={plan.id}
                                         style={[ styles.planItem, selectedPlans.includes(plan.id) && styles.selectedPlan, buttonLoading && styles.disabledOpacity ]}
                                         onPress={() => togglePlanSelection(plan.id)}
                                         disabled={buttonLoading}
                                      >
                                            <View style={styles.checkbox}><Icon name={selectedPlans.includes(plan.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedPlans.includes(plan.id) ? '#FF0000' : '#555'} /></View>
                                            <View style={styles.planDetails}>
                                               <Text style={styles.planText} numberOfLines={1}>{plan.planName || `Plan ${plan.id.substring(0,4)}`}</Text>
                                               {plan.planType && <Text style={styles.planType}>({plan.planType})</Text>}
                                               {plan.duration && <Text style={styles.planDuration}>{plan.duration} mo</Text>}
                                               {plan.interestRate != null && <Text style={styles.planInterest}>{plan.interestRate}%</Text>}
                                            </View>
                                      </TouchableOpacity>
                                  ))}
                               </View>
                          </>
                       )}
                       {!loadingBNPL && fetchedBNPLPlans.length === 0 && paymentOption.BNPL && (
                            <Text style={styles.noPlansText}> No Published BNPL plans available. </Text>
                       )}
                      </>
                 )}

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton, buttonLoading && styles.disabledOpacity]}
                        onPress={onDismiss}
                        disabled={buttonLoading}
                    >
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton, buttonLoading && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={buttonLoading}
                    >
                        {buttonLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{isEditMode ? 'Update Product' : 'Save Product'}</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {imagePreview && ( <PreviewModal visible={!!imagePreview} transparent={true} animationType="fade" onRequestClose={closePreview} > <View style={styles.modalContainer}><TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Image source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" /></View></PreviewModal> )}
            {videoPreview && ( <PreviewModal visible={!!videoPreview} transparent={true} animationType="fade" onRequestClose={closePreview} > <View style={styles.modalContainer}><TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Video source={{ uri: videoPreview }} style={styles.previewVideo} useNativeControls resizeMode="contain" shouldPlay={true} onError={(err) => { console.error("Video Preview Error:", err); Alert.alert("Video Error", "Could not load the video for preview."); closePreview(); }} /></View></PreviewModal> )}

        </View>
    );
};

UploadProductComponent.propTypes = {
    visible: PropTypes.bool.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    productForEdit: PropTypes.object,
};

const styles = StyleSheet.create({
    componentRoot: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
        flexGrow: 1,
        padding: 15,
        backgroundColor: '#fff',
        paddingBottom: 50,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    loadingText: {
        marginTop: 10,
        color: Platform.OS === 'ios' ? '#555' : '#eee',
        fontSize: 16
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingTop: Platform.OS === 'ios' ? 45 : 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
        marginLeft: 40,
    },
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 40 : 10,
        right: 10,
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        padding: 5,
        borderRadius: 25,
        zIndex: 10,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
        marginTop: 12,
    },
    submitErrorText: {
        marginBottom: 15, paddingVertical: 8, paddingHorizontal: 12,
        textAlign: 'center', fontSize: 14, fontWeight: 'bold',
        color: '#B00020', backgroundColor: '#fdecea',
        borderWidth: 1, borderColor: '#B00020', borderRadius: 4,
    },
    inputField: {
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    descriptionInput: {
        height: 100,
        textAlignVertical: 'top',
    },
    errorTextAbove: {
        paddingBottom: 0, marginBottom: 2, paddingLeft: 2,
        fontSize: 12, color: '#B00020',
    },
    infoText: {
        paddingBottom: 0, marginBottom: 2, paddingLeft: 2,
        fontSize: 12, color: '#00529B', marginTop: -8
    },
    warningText: {
        fontSize: 13, color: '#ff8c00', textAlign: 'center',
        marginVertical: 5, paddingHorizontal: 10,
    },
    pickerContainer: {
        borderRadius: 4, borderWidth: 1, borderColor: 'grey',
        backgroundColor: '#fff', marginBottom: 12,
        overflow: 'hidden',
        minHeight: 50,
        justifyContent: 'center',
    },
    picker: { color: '#000', height: 55, width: '100%' },
    pickerPlaceholder: { color: '#999', },
    pickerErrorBorder: { borderColor: '#B00020', borderWidth: 1.5, },
    inlineLoader: { alignSelf: 'flex-start', marginLeft: 10, marginBottom: -10, marginTop: -5 },
    mediaButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8, marginTop: 5, },
    selectMediaButton: {
        backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: 8, alignItems: 'center', flexDirection: 'row',
        flex: 1, marginHorizontal: 5, justifyContent: 'center', minHeight: 45,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1,
    },
    selectMediaText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center', },
    buttonIcon: { marginRight: 8, },
    mediaHint: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 15, marginTop: 4, paddingHorizontal: 10, },
    mediaPreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, marginTop: 5, },
    mediaPreviewWrapper: { marginRight: 10, marginBottom: 10, },
    mediaPreview: {
        position: 'relative', borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
        overflow: 'hidden', backgroundColor: '#eee',
        width: 80, height: 80, justifyContent: 'center', alignItems: 'center',
    },
    mediaImage: { width: '100%', height: '100%', },
    mediaVideoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', },
    uploadIndicator: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingVertical: 2, alignItems: 'center', justifyContent: 'center',
    },
    newIndicator: { backgroundColor: 'rgba(255, 165, 0, 0.8)', },
    uploadedIndicator: { backgroundColor: 'rgba(0, 128, 0, 0.7)', },
    uploadIndicatorText: { color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: 'bold', },
    removeMediaButton: {
        position: 'absolute', top: -8, right: -8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 15, padding: 3, zIndex: 1,
    },
    paymentOptions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, marginTop: 5, },
    paymentOptionButton: {
        paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8,
        backgroundColor: '#f0f1f1', flex: 1, marginHorizontal: 5,
        alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
        borderWidth: 1, borderColor: '#ddd', minHeight: 50,
    },
    paymentOptionErrorBorder: { borderColor: '#B00020', borderWidth: 1.5, },
    paymentOptionText: { fontSize: 15, fontWeight: 'bold', color: '#444', },
    selectedPaymentOption: { borderColor: '#FF0000', backgroundColor: '#fff', borderWidth: 1.5, },
    selectedPaymentOptionText: { color: '#FF0000', },
    bnplListContainer: { marginBottom: 15, borderRadius: 6, borderWidth: 1, borderColor: '#e0e0e0', overflow: 'hidden', backgroundColor: '#fdfdfd', },
    bnplContainerErrorBorder: { borderColor: '#B00020', borderWidth: 1.5, },
    selectAllContainer: { borderBottomWidth: 1, borderBottomColor: '#ccc', backgroundColor: '#f0f0f0', },
    planItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff', },
    selectedPlan: { backgroundColor: '#ffebee', borderColor: '#ffcdd2', borderWidth: 1, marginHorizontal: -1, borderBottomColor: '#ffcdd2', },
    checkbox: { width: 24, height: 24, marginRight: 12, justifyContent: 'center', alignItems: 'center', },
    planDetails: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', },
    planText: { fontSize: 15, fontWeight: '500', color: '#333', flexShrink: 1, marginRight: 5, },
    planType: { fontSize: 13, color: '#666', fontStyle: 'italic', marginHorizontal: 5, },
    planDuration: { fontSize: 13, fontWeight: '500', color: '#444', marginHorizontal: 5, },
    planInterest: { fontSize: 13, fontWeight: '500', color: '#555', marginLeft: 'auto', paddingLeft: 8, },
    selectAllPlansText: { fontSize: 15, fontWeight: '600', color: '#FF0000', },
    noPlansText: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 15, marginBottom: 15, fontStyle: 'italic', },
    buttonContainer: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: 25, borderTopWidth: 1, borderTopColor: '#eee',
        paddingTop: 15, paddingBottom: 10,
    },
    button: {
        flex: 1, paddingVertical: 14, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
        minHeight: 50,
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 2,
    },
    cancelButton: { backgroundColor: '#6c757d', marginRight: 10, },
    saveButton: { backgroundColor: '#FF0000', marginLeft: 10, },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', },
    disabledButton: { backgroundColor: '#ff9999', opacity: 0.8, elevation: 0, shadowOpacity: 0, },
    disabledOpacity: { opacity: 0.6, },
    modalContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    modalCloseButton: {
        position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 15,
        zIndex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 25,
    },
    previewImage: { width: '95%', height: '80%', },
    previewVideo: { width: '95%', height: '80%', backgroundColor: '#000', },
});

export default UploadProductComponent;