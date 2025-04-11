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
import { db } from '../firebaseConfig'; // Ensure this path is correct

// Ensure this path is correct
import {
    uploadImage as uploadImageToCloudinary,
    uploadVideo as uploadVideoToCloudinary
} from './UploadImage'; // Adjust path if necessary

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


    // This useEffect doesn't seem necessary as prevProductForEditId is updated correctly within the main effect.
    // Keeping it doesn't hurt, but it could potentially be removed.
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
           if (!currentOptionState) { // If BNPL is being turned ON
               const plansToPreserve = isEditMode ? (productForEdit?.BNPLPlans || []) : [];
               if (fetchedBNPLPlans.length === 0) {
                   fetchBNPLPlans(plansToPreserve); // Fetch if not already fetched
               } else if(isEditMode) { // If plans are already fetched, restore selection for edit mode
                 const validInitialPlans = (productForEdit?.BNPLPlans || []).filter(id => fetchedBNPLPlans.some(p => p.id === id));
                 setSelectedPlans(validInitialPlans);
                 setSelectAll(fetchedBNPLPlans.length > 0 && validInitialPlans.length === fetchedBNPLPlans.length);
               } else { // If plans are fetched but not in edit mode, clear selection
                 setSelectedPlans([]);
                 setSelectAll(false);
               }
           } else { // If BNPL is being turned OFF
               setSelectedPlans([]);
               setSelectAll(false);
               setLoadingBNPL(false); // Ensure loading indicator is off
               // No need to clear fetchedBNPLPlans, might be needed later if user toggles back
               if (submitAttempted) {
                   setFormErrors(prev => ({ ...prev, bnplPlans: null })); // Clear BNPL plan validation error
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
        const hasVideo = !!media.video;
        if (!hasImages && !hasVideo) { // Allow product with only video? Assuming at least one image is still required as per previous logic
            errors.media = 'At least one image is required.';
        } else if (!hasImages) { // If only video exists, check if this is allowed
             // If only a video is allowed, remove this error. Assuming image is required based on previous logic.
             errors.media = 'At least one image is required.';
        }

        if (paymentOption.BNPL && !loadingBNPL) {
            if (fetchedBNPLPlans.length === 0) {
                 console.warn(modeLogPrefix, "Validation Check: BNPL selected but no plans available/loaded.");
                 // Decide if this should be an error: errors.bnplPlans = 'No BNPL plans available.';
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
        media.images.length, media.video, paymentOption.BNPL, selectedPlans.length,
        loadingBNPL, fetchedBNPLPlans.length, modeLogPrefix
    ]);

    const handleInputChange = useCallback((setter, fieldName) => (value) => {
        setter(value);
        if (submitAttempted) {
            // Use functional update for setters if depending on previous state, although not strictly needed here.
            // Validate specific fields that depend on each other immediately
            if (fieldName === 'originalPrice' || fieldName === 'discountedPrice') {
                 // Re-run validation silently to update related errors
                 const currentErrors = validateForm(false);
                 setFormErrors(prev => ({
                    ...prev,
                    [fieldName]: currentErrors[fieldName] || null, // Clear current field's error if valid now
                    // Also update the *other* price field's error if it changed
                    originalPrice: prev.originalPrice && fieldName !== 'originalPrice' ? currentErrors.originalPrice || null : prev.originalPrice,
                    discountedPrice: prev.discountedPrice && fieldName !== 'discountedPrice' ? currentErrors.discountedPrice || null : prev.discountedPrice
                 }));
            } else {
                // For other fields, just clear their specific error
                 setFormErrors(prev => ({ ...prev, [fieldName]: null }));
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
                 setFormErrors(prev => ({
                     ...prev,
                     bnplPlans: (newSelectedPlans.length === 0 && fetchedBNPLPlans.length > 0)
                         ? 'Please select at least one BNPL plan.'
                         : null // Clear error if at least one is selected or no plans exist
                 }));
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
           setFormErrors(prev => ({
               ...prev,
               bnplPlans: (newSelectedPlans.length === 0 && fetchedBNPLPlans.length > 0)
                   ? 'Please select at least one BNPL plan.'
                   : null
           }));
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
                // requestMediaLibraryPermissionsAsync includes Video library access
                permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            }
            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    `Permission to access the ${permissionType === 'camera' ? 'camera' : 'media library'} is required. Please grant permission in your device settings.`,
                    [{ text: 'OK' }]
                );
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
              allowsMultipleSelection: isImage, // Only allow multiple for images
              selectionLimit: isImage ? selectionLimit : 1, // Apply limit, 1 for video
              quality: isImage ? 0.8 : 1, // Video quality handled differently (bitrate etc.)
              // Consider adding videoExportPreset for videos if needed
              // videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
             console.log(`${modeLogPrefix} Media selection cancelled or no assets returned.`);
             return;
          }

          let addedCount = 0;
          if (isImage) {
              const validNewImages = result.assets
                  .filter(asset => asset?.uri && typeof asset.uri === 'string')
                  .map(asset => ({ uri: asset.uri, isUploaded: false }));

              if (validNewImages.length > 0) {
                 addedCount = validNewImages.length;
                 // Ensure we don't exceed the limit due to race conditions (unlikely here)
                 const imagesToAdd = validNewImages.slice(0, selectionLimit);
                 if (imagesToAdd.length !== validNewImages.length) {
                      console.warn(`${modeLogPrefix} Selected more images than limit allows, trimming selection.`);
                      Alert.alert("Limit Applied", `Only ${imagesToAdd.length} images were added due to the limit.`);
                 }
                 setMedia(prevMedia => ({ ...prevMedia, images: [...prevMedia.images, ...imagesToAdd] }));
              }
             // Report if some assets were invalid or filtered out (though filter is basic)
             if (validNewImages.length !== result.assets.length) {
                 console.warn(`${modeLogPrefix} Some selected assets were invalid or did not have a URI.`);
                 if (validNewImages.length === 0) Alert.alert("Selection Error", "None of the selected items could be processed.");
             }

          } else { // Handling Video
              const videoAsset = result.assets[0];
              if (videoAsset?.uri && typeof videoAsset.uri === 'string') {
                 // Re-check limits just before setting state
                 if (checkMediaLimits(MEDIA_TYPES.VIDEO, 1)) {
                     addedCount = 1;
                     setMedia(prevMedia => ({ ...prevMedia, video: { uri: videoAsset.uri, isUploaded: false } }));
                 } else {
                     // This case should ideally be prevented by the initial check, but good as a safeguard
                     console.warn(modeLogPrefix, "Video addition blocked by checkMediaLimits just before state update.");
                 }
              } else {
                 Alert.alert("Invalid Video", "The selected video file could not be processed (missing URI).");
              }
          }

          // Clear validation error only if something was actually added
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

      // Check limits before launching camera
      if (!checkMediaLimits(type, 1)) return;

      try {
          const result = await ImagePicker.launchCameraAsync({
              mediaTypes: mediaTypesOption,
              allowsEditing: false, // Editing might change format/metadata, usually disable for uploads
              quality: isImage ? 0.8 : 1, // Base quality for images
              // videoMaxDuration: 60, // Example: Limit video duration if needed
          });

          if (result.canceled || !result.assets || result.assets.length === 0) {
             console.log(`${modeLogPrefix} Camera capture cancelled or no assets returned.`);
             return;
          }

          const asset = result.assets[0];
          let added = false;
           if (asset?.uri && typeof asset.uri === 'string') {
               // Re-check limits just before setting state as a safeguard
              if (isImage) {
                  if (checkMediaLimits(MEDIA_TYPES.IMAGE, 1)) {
                       setMedia(prevMedia => ({ ...prevMedia, images: [...prevMedia.images, { uri: asset.uri, isUploaded: false }] }));
                       added = true;
                  }
              } else { // Handling Video
                  if (checkMediaLimits(MEDIA_TYPES.VIDEO, 1)) {
                       setMedia(prevMedia => ({ ...prevMedia, video: { uri: asset.uri, isUploaded: false } }));
                       added = true;
                  }
              }

              if (added) {
                  if (submitAttempted) { setFormErrors(prev => ({ ...prev, media: null })); }
              } else {
                  // This might happen if the state changed between the initial check and now
                  Alert.alert("Limit Reached", `Could not add the captured ${type} due to media limits.`);
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
        const actionDescription = itemToRemove.isUploaded
            ? `Are you sure you want to remove this ${mediaIdentifier}?\n(It was previously uploaded and will be removed from this product.)`
            : `Are you sure you want to remove this ${mediaIdentifier}?`;


        Alert.alert(
           "Remove Media", actionDescription,
           [
               { text: "Cancel", style: "cancel" },
               {
                   text: "Remove", style: "destructive", onPress: () => {
                       setMedia(prevMedia => {
                            let updatedImages = [...prevMedia.images];
                            let updatedVideo = prevMedia.video;
                            let mediaRemoved = false;

                            if (isImage) {
                                if (indexOrType >= 0 && indexOrType < updatedImages.length) {
                                   updatedImages.splice(indexOrType, 1);
                                   mediaRemoved = true;
                                } else {
                                    console.warn(`${modeLogPrefix} Invalid index for image removal: ${indexOrType}`);
                                    return prevMedia; // Return previous state if index is invalid
                                }
                            } else { // Removing video
                                if (updatedVideo) { // Check if video exists before setting to null
                                    updatedVideo = null;
                                    mediaRemoved = true;
                                } else {
                                     console.warn(`${modeLogPrefix} Attempted to remove non-existent video.`);
                                     return prevMedia;
                                }
                            }

                           // Update validation state only if media was actually removed
                           if (mediaRemoved && submitAttempted) {
                               // Re-validate the media field silently
                               const currentErrors = validateForm(false);
                               setFormErrors(prevErr => ({ ...prevErr, media: currentErrors.media || null }));
                           }

                            return { images: updatedImages, video: updatedVideo };
                       });
                   }
               }
           ]
       );
    }, [media.images, media.video, submitAttempted, modeLogPrefix, validateForm]); // Added validateForm dependency

     const showMediaSourceOptions = useCallback((type) => {
        Keyboard.dismiss(); // Dismiss keyboard before showing alert
        const title = type === MEDIA_TYPES.IMAGE ? "Select Image Source" : "Select Video Source";
        const options = [
            { text: "Choose from Gallery", onPress: () => pickMediaFromLibrary(type) },
            // Camera option might not be available on web or simulators
            ...(Platform.OS !== 'web' ? [{ text: "Use Camera", onPress: () => captureMediaWithCamera(type) }] : []),
            { text: "Cancel", style: "cancel" },
        ];
        Alert.alert(title, "", options); // No message needed in Alert body
    }, [pickMediaFromLibrary, captureMediaWithCamera]);

     const handleImagePreview = useCallback((uri) => { if (uri && typeof uri === 'string') setImagePreview(uri); }, []);
     const handleVideoPreview = useCallback((uri) => { if (uri && typeof uri === 'string') setVideoPreview(uri); }, []);
     const closePreview = useCallback(() => { setImagePreview(null); setVideoPreview(null); }, []);


    const handleSubmit = useCallback(async () => {
        Keyboard.dismiss();
        setSubmitAttempted(true);

        if (!validateForm(true)) {
            // Find the first error key to potentially scroll to later if needed
            const firstErrorKey = Object.keys(formErrors).find(key => formErrors[key]);
            console.log(`${modeLogPrefix} Validation failed. First error: ${firstErrorKey}`);
            Alert.alert('Validation Error', 'Please review the form and fix the indicated errors.');
            // Optionally scroll to the first error field here using refs
            return;
        }

        if (typeof onSave !== 'function') {
            console.error(`${modeLogPrefix} onSave prop is missing or not a function! Cannot submit.`);
            Alert.alert('Configuration Error', 'Cannot save product. Please contact support.');
            return;
        }

        setButtonLoading(true);
        setFormErrors({}); // Clear errors before attempting save

        try {
            // --- Media Upload ---
            const newImagesToUpload = media.images.filter(img => !img.isUploaded);
            const newVideoToUpload = media.video && !media.video.isUploaded ? media.video : null;

            const existingImageUrls = media.images.filter(img => img.isUploaded).map(img => img.uri);
            const existingVideoUrl = media.video && media.video.isUploaded ? media.video.uri : null;

            let uploadedNewImageUrls = [];
            let uploadedNewVideoUrl = null;

            // Upload new images
            if (newImagesToUpload.length > 0) {
                console.log(`${modeLogPrefix} Uploading ${newImagesToUpload.length} new image(s)...`);
                const uploadImagePromises = newImagesToUpload.map(image =>
                    uploadImageToCloudinary({ uri: image.uri }) // Assuming UploadImage returns { cloudinaryUrl: '...' } or throws
                );
                // Using Promise.allSettled to handle individual failures gracefully
                const uploadedImageResults = await Promise.allSettled(uploadImagePromises);

                uploadedImageResults.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value?.cloudinaryUrl) {
                        uploadedNewImageUrls.push(result.value.cloudinaryUrl);
                    } else {
                        // Log specific error and throw a general error to stop the process
                        const originalUri = newImagesToUpload[index]?.uri.slice(-20); // Log end of URI for identification
                        const errorReason = result.reason instanceof Error ? result.reason.message : JSON.stringify(result.reason);
                        console.error(`${modeLogPrefix} New image upload failed (URI ending: ...${originalUri}): ${errorReason}`);
                        // Throw a user-friendly error
                        throw new Error(`An image upload failed. Please check connection and try again.`);
                    }
                });
                 console.log(`${modeLogPrefix} Image uploads completed.`);
            }

            // Upload new video
            if (newVideoToUpload) {
                 console.log(`${modeLogPrefix} Uploading new video...`);
                try {
                    const videoResult = await uploadVideoToCloudinary({ uri: newVideoToUpload.uri }); // Assuming same return structure
                    if (videoResult?.cloudinaryUrl) {
                        uploadedNewVideoUrl = videoResult.cloudinaryUrl;
                         console.log(`${modeLogPrefix} Video upload completed.`);
                    } else {
                        // If upload function resolves but without a URL
                        throw new Error("Video upload function did not return a valid URL.");
                    }
                } catch (error) {
                    // Catch errors specifically from the video upload function
                    const errorMessage = error instanceof Error ? error.message : "Unknown video upload error";
                    console.error(`${modeLogPrefix} New video upload failed: ${errorMessage}`);
                    // Throw a user-friendly error
                    throw new Error(`Video upload failed: ${errorMessage}. Please try again.`);
                }
            }

            // --- Prepare Final Data ---
            const finalImageUrls = [...existingImageUrls, ...uploadedNewImageUrls];
            const finalVideoUrl = uploadedNewVideoUrl || existingVideoUrl; // Prioritize newly uploaded video URL

            const origPrice = Number(originalPrice);
            const discPriceRaw = discountedPrice.trim();
            // Ensure discounted price is a number, >= 0, and < original price
            const discPriceNum = (discPriceRaw && !isNaN(Number(discPriceRaw))) ? Number(discPriceRaw) : null;

            const finalDiscountedPrice = (discPriceNum !== null && discPriceNum >= 0 && discPriceNum < origPrice)
                                        ? discPriceNum
                                        : null; // Store null if invalid or empty

             // Determine final price (use discounted if valid, otherwise original)
            const finalPrice = finalDiscountedPrice !== null ? finalDiscountedPrice : origPrice;

            // Construct the data object to be saved
            const productData = {
                // Add the id back if we are editing, Firestore needs it for update context but not in the data payload
                ...(isEditMode && productForEdit?.id ? { id: productForEdit.id } : {}),

                name: productName.trim(),
                category: category, // Assuming category ID is stored
                description: description.trim(),
                originalPrice: origPrice,
                discountedPrice: finalDiscountedPrice, // Store null if not applicable/valid
                price: finalPrice, // Calculated price field
                media: {
                    images: finalImageUrls,
                    video: finalVideoUrl // Store null if no video
                },
                paymentOption: paymentOption, // Store the whole object { COD: bool, BNPL: bool }
                BNPLPlans: paymentOption.BNPL ? selectedPlans : [], // Store empty array if BNPL is off
                // Timestamps should be handled by the parent (ProductScreen) using serverTimestamp()
            };

             console.log(`${modeLogPrefix} Calling onSave with data:`, /* JSON.stringify(productData, null, 2) */ productData); // Avoid logging potentially large data in production
            // --- Call Parent Save Function ---
            await onSave(productData); // Let the parent handle the actual Firestore write

            // Success! Parent should handle closing the modal via onDismiss after successful save.

        } catch (error) {
            // Catch errors from validation, uploads, or the onSave call itself
            console.error(`${modeLogPrefix} Product ${isEditMode ? 'update' : 'creation'} failed during handleSubmit:`, error);
            const displayMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
            // Show specific error if available, otherwise generic
            setFormErrors({ submit: displayMessage }); // Display error near submit button
            Alert.alert('Save Error', displayMessage);
        } finally {
             // Ensure loading state is turned off even if errors occurred
            if (isMounted.current) {
               setButtonLoading(false);
            }
        }
    }, [
        isEditMode, productForEdit?.id, // Added productForEdit.id dependency for edit case
        productName, category, description, originalPrice, discountedPrice,
        media, paymentOption, selectedPlans,
        validateForm, onSave, formErrors, // Added formErrors to dependencies of validateForm
        modeLogPrefix
    ]);


     const renderFieldError = (fieldName) => {
       // Only render HelperText if there's an error for this field
       if (formErrors[fieldName]) {
         return (
             <HelperText type="error" visible={true} style={styles.errorTextAbove}>
                {formErrors[fieldName]}
             </HelperText>
         );
       }
       return null; // Render nothing if no error
     };

     // Calculate media limits/states based on current media state
     const imageLimit = media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES;
     const isImageLimitReached = media.images.length >= imageLimit;
     const isVideoLimitReached = !!media.video;
     const canAddVideo = !isVideoLimitReached && media.images.length <= MAX_IMAGES_WITH_VIDEO;
     const canAddImage = !isImageLimitReached;

    return (
        <View style={styles.componentRoot}>
            {/* Keep ScrollView outside the main content for better keyboard handling */}
            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled" // Good for forms
                keyboardDismissMode="on-drag" // Optional: dismiss keyboard on scroll
            >
                {/* Header inside ScrollView for consistent scrolling */}
                <View style={styles.headerRow}>
                    <Text style={styles.modalTitle}>{isEditMode ? 'Edit Product' : 'Add New Product'}</Text>
                    {/* Close button remains easily accessible */}
                    <TouchableOpacity style={styles.closeButton} onPress={onDismiss} disabled={buttonLoading} accessibilityLabel="Close product form">
                        <Icon name="close-circle" size={30} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Display general submission error at the top */}
                {renderFieldError('submit')}

                 {/* --- Media Section --- */}
                 <Text style={styles.label}>Product Media</Text>
                 {renderFieldError('media')}
                 <View style={styles.mediaPreviewContainer}>
                     {/* Image Previews */}
                     {media.images.map((img, index) => (
                         <TouchableOpacity
                             key={`${index}-${img.uri.slice(-10)}`} // More stable key using index + part of URI
                             onPress={() => handleImagePreview(img.uri)}
                             disabled={buttonLoading}
                             style={styles.mediaPreviewWrapper}
                             activeOpacity={0.7}
                             accessibilityLabel={`Preview image ${index + 1}`}
                         >
                             <View style={styles.mediaPreview}>
                                 <Image
                                     source={{ uri: img.uri }}
                                     style={styles.mediaImage}
                                     onError={(e) => console.warn(`${modeLogPrefix} Image load error for URI ${img.uri.slice(-10)}:`, e.nativeEvent.error)}
                                 />
                                 {/* Upload Status Indicators */}
                                 {!img.isUploaded && (
                                     <View style={[styles.uploadIndicator, styles.newIndicator]}>
                                         <Text style={styles.uploadIndicatorText}>New</Text>
                                     </View>
                                 )}
                                 {img.isUploaded && (
                                     <View style={[styles.uploadIndicator, styles.uploadedIndicator]}>
                                         <Icon name="cloud-check-outline" size={12} color="#fff"/>
                                     </View>
                                 )}
                                 {/* Remove Button */}
                                 <TouchableOpacity
                                     onPress={() => removeMedia(index, MEDIA_TYPES.IMAGE)}
                                     style={styles.removeMediaButton}
                                     disabled={buttonLoading}
                                     accessibilityLabel={`Remove image ${index + 1}`}
                                 >
                                     <Icon name="close-circle" size={22} color="#fff" />
                                 </TouchableOpacity>
                             </View>
                         </TouchableOpacity>
                     ))}
                     {/* Video Preview */}
                     {media.video && (
                         <TouchableOpacity
                             key={media.video.uri.slice(-10)} // Key for video
                             onPress={() => handleVideoPreview(media.video.uri)}
                             disabled={buttonLoading}
                             style={styles.mediaPreviewWrapper}
                             activeOpacity={0.7}
                             accessibilityLabel="Preview video"
                         >
                             <View style={styles.mediaPreview}>
                                 {/* Placeholder for video */}
                                 <View style={styles.mediaVideoPlaceholder}><Icon name="play-circle-outline" size={40} color="#FFF" /></View>
                                 {/* Upload Status Indicators */}
                                  {!media.video.isUploaded && (
                                     <View style={[styles.uploadIndicator, styles.newIndicator]}>
                                         <Text style={styles.uploadIndicatorText}>New</Text>
                                     </View>
                                  )}
                                 {media.video.isUploaded && (
                                     <View style={[styles.uploadIndicator, styles.uploadedIndicator]}>
                                         <Icon name="cloud-check-outline" size={12} color="#fff"/>
                                     </View>
                                 )}
                                 {/* Remove Button */}
                                 <TouchableOpacity
                                     onPress={() => removeMedia(null, MEDIA_TYPES.VIDEO)} // Use null or specific ID for video type
                                     style={styles.removeMediaButton}
                                     disabled={buttonLoading}
                                     accessibilityLabel="Remove video"
                                 >
                                     <Icon name="close-circle" size={22} color="#fff" />
                                 </TouchableOpacity>
                             </View>
                         </TouchableOpacity>
                     )}
                 </View>

                 {/* Media Hints and Warnings */}
                 <Text style={styles.mediaHint}>Max {MAX_IMAGES} images OR {MAX_IMAGES_WITH_VIDEO} images + {MAX_VIDEOS} video.</Text>
                 {media.images.length > MAX_IMAGES_WITH_VIDEO && !media.video && (
                     <Text style={styles.warningText}>Remove images to add a video (max {MAX_IMAGES_WITH_VIDEO} images with video).</Text>
                 )}

                 {/* Media Selection Buttons */}
                 <View style={styles.mediaButtonContainer}>
                     <TouchableOpacity
                         onPress={() => showMediaSourceOptions(MEDIA_TYPES.IMAGE)}
                         style={[styles.selectMediaButton, (!canAddImage || buttonLoading) && styles.disabledOpacity]}
                         disabled={!canAddImage || buttonLoading}
                         accessibilityLabel={`Add image, limit ${imageLimit}, current ${media.images.length}`}
                         accessibilityState={{ disabled: !canAddImage || buttonLoading }}
                     >
                         <Icon name="image-plus" size={20} color="#fff" style={styles.buttonIcon} />
                         <Text style={styles.selectMediaText}>Add Image ({media.images.length}/{imageLimit})</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                         onPress={() => showMediaSourceOptions(MEDIA_TYPES.VIDEO)}
                         style={[styles.selectMediaButton, (!canAddVideo || buttonLoading) && styles.disabledOpacity]}
                         disabled={!canAddVideo || buttonLoading}
                         accessibilityLabel={isVideoLimitReached ? "Video already added" : "Add video"}
                         accessibilityState={{ disabled: !canAddVideo || buttonLoading }}
                     >
                         <Icon name="video-plus" size={20} color="#fff" style={styles.buttonIcon} />
                         <Text style={styles.selectMediaText}>{isVideoLimitReached ? 'Video Added' : 'Add Video'}</Text>
                     </TouchableOpacity>
                 </View>

                {/* --- Product Details --- */}
                {renderFieldError('productName')}
                <PaperInput label="Product Name" value={productName} mode="outlined" onChangeText={handleInputChange(setProductName, 'productName')} outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.productName} disabled={buttonLoading} style={styles.inputField} />

                {renderFieldError('description')}
                <PaperInput label="Description" mode="outlined" value={description} onChangeText={handleInputChange(setDescription, 'description')} outlineColor="grey" activeOutlineColor="#FF0000" multiline={true} numberOfLines={4} error={!!formErrors.description} disabled={buttonLoading} style={[styles.inputField, styles.descriptionInput]} />

                {renderFieldError('originalPrice')}
                <PaperInput label="Original Price (PKR)" mode="outlined" value={originalPrice} onChangeText={handleInputChange(setOriginalPrice, 'originalPrice')} keyboardType="numeric" outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.originalPrice} disabled={buttonLoading} style={styles.inputField} />

                {renderFieldError('discountedPrice')}
                <PaperInput label="Discounted Price (PKR) (Optional)" mode="outlined" value={discountedPrice} onChangeText={handleInputChange(setDiscountedPrice, 'discountedPrice')} keyboardType="numeric" outlineColor="grey" activeOutlineColor="#FF0000" error={!!formErrors.discountedPrice} disabled={buttonLoading} style={styles.inputField} />
                {/* Informational text, not an error */}
                {discountedPrice.trim() && Number(discountedPrice) >= Number(originalPrice) && !formErrors.discountedPrice && (
                     <HelperText type="info" visible={true} style={styles.infoText}>Discounted price must be lower than original price to apply.</HelperText>
                 )}

                {/* --- Category --- */}
                <Text style={styles.label}>Category</Text>
                {loadingCategories && <ActivityIndicator size="small" color="#FF0000" style={styles.inlineLoader} />}
                {renderFieldError('category')}
                 <View style={[ styles.pickerContainer, !!formErrors.category && styles.pickerErrorBorder ]}>
                     <Picker
                        selectedValue={category}
                        style={styles.picker}
                        onValueChange={(itemValue) => {
                            // Only update state if value changes and is not the placeholder
                            if (itemValue !== category && itemValue) {
                                handleInputChange(setCategory, 'category')(itemValue);
                            }
                        }}
                        enabled={!loadingCategories && !buttonLoading && fetchedCategories.length > 0}
                        dropdownIconColor="#555"
                        mode="dropdown" // 'dialog' on Android might look different
                        prompt="Select a Category" // Used for dialog mode title
                     >
                         {/* Placeholder Item */}
                         <Picker.Item label="-- Select Category --" value="" style={styles.pickerPlaceholder} enabled={false} />
                         {/* Category Items */}
                         {fetchedCategories.map((cat) => (
                            <Picker.Item key={cat.id} label={cat.categoryName || `Unnamed (${cat.id.substring(0,4)})`} value={cat.id} />
                         ))}
                     </Picker>
                 </View>
                 {/* Message if no categories loaded */}
                 {!loadingCategories && fetchedCategories.length === 0 && visible && (
                    <Text style={styles.warningText}>No categories found or failed to load. Cannot select category.</Text>
                 )}

                 {/* --- Payment Options --- */}
                 <Text style={styles.label}>Payment Options</Text>
                 {renderFieldError('paymentOption')}
                 <View style={styles.paymentOptions}>
                     <TouchableOpacity
                         onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.COD)}
                         style={[ styles.paymentOptionButton, paymentOption.COD && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity ]}
                         disabled={buttonLoading}
                         accessibilityLabel="Cash on Delivery payment option"
                         accessibilityState={{ checked: paymentOption.COD, disabled: buttonLoading }}
                     >
                         <Icon name={paymentOption.COD ? "check-circle" : "circle-outline"} size={20} color={paymentOption.COD ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                         <Text style={[styles.paymentOptionText, paymentOption.COD && styles.selectedPaymentOptionText]}> COD </Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                         onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL)}
                         style={[ styles.paymentOptionButton, paymentOption.BNPL && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity ]}
                         disabled={buttonLoading}
                         accessibilityLabel="Buy Now Pay Later payment option"
                         accessibilityState={{ checked: paymentOption.BNPL, disabled: buttonLoading }}
                      >
                        <Icon name={paymentOption.BNPL ? "check-circle" : "circle-outline"} size={20} color={paymentOption.BNPL ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                         <Text style={[styles.paymentOptionText, paymentOption.BNPL && styles.selectedPaymentOptionText]}> BNPL </Text>
                     </TouchableOpacity>
                 </View>

                 {/* --- BNPL Plans (Conditional) --- */}
                 {paymentOption.BNPL && (
                      <>
                       {/* Loading Indicator for BNPL */}
                       {loadingBNPL && (
                           <View style={styles.loadingContainer}>
                               <ActivityIndicator size="large" color="#FF0000" />
                               <Text style={styles.loadingText}>Loading BNPL Plans...</Text>
                           </View>
                       )}
                       {/* BNPL Plan List (if loaded and available) */}
                       {!loadingBNPL && fetchedBNPLPlans.length > 0 && (
                          <>
                               <Text style={styles.label}>Available BNPL Plan(s)</Text>
                               {renderFieldError('bnplPlans')}
                               <View style={[styles.bnplListContainer, !!formErrors.bnplPlans && styles.bnplContainerErrorBorder]}>
                                   {/* Select/Deselect All */}
                                   <TouchableOpacity
                                       onPress={toggleSelectAllPlans}
                                       style={[styles.planItem, styles.selectAllContainer, (buttonLoading || fetchedBNPLPlans.length === 0) && styles.disabledOpacity]}
                                       disabled={buttonLoading || fetchedBNPLPlans.length === 0}
                                       accessibilityLabel={selectAll ? 'Deselect all BNPL plans' : 'Select all BNPL plans'}
                                       accessibilityState={{ checked: selectAll, disabled: buttonLoading || fetchedBNPLPlans.length === 0 }}
                                    >
                                       <View style={styles.checkbox}><Icon name={selectAll ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectAll ? '#FF0000' : '#555'} /></View>
                                       <Text style={styles.selectAllPlansText}> {selectAll ? 'Deselect All Plans' : 'Select All Plans'} </Text>
                                   </TouchableOpacity>
                                  {/* Individual Plan Items */}
                                  {fetchedBNPLPlans.map((plan) => (
                                      <TouchableOpacity
                                         key={plan.id}
                                         style={[ styles.planItem, selectedPlans.includes(plan.id) && styles.selectedPlan, buttonLoading && styles.disabledOpacity ]}
                                         onPress={() => togglePlanSelection(plan.id)}
                                         disabled={buttonLoading}
                                         accessibilityLabel={`BNPL Plan: ${plan.planName || 'Unnamed Plan'}. Tap to ${selectedPlans.includes(plan.id) ? 'deselect' : 'select'}`}
                                         accessibilityState={{ checked: selectedPlans.includes(plan.id), disabled: buttonLoading }}
                                      >
                                            <View style={styles.checkbox}><Icon name={selectedPlans.includes(plan.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedPlans.includes(plan.id) ? '#FF0000' : '#555'} /></View>
                                            <View style={styles.planDetails}>
                                               <Text style={styles.planText} numberOfLines={1}>{plan.planName || `Plan ${plan.id.substring(0,4)}`}</Text>
                                               {plan.planType && <Text style={styles.planType}>({plan.planType})</Text>}
                                               {/* Duration Text Removed Here */}
                                               {plan.interestRate != null && <Text style={styles.planInterest}>{plan.interestRate}%</Text>}
                                            </View>
                                      </TouchableOpacity>
                                  ))}
                               </View>
                          </>
                       )}
                       {/* Message if BNPL selected but no plans available */}
                       {!loadingBNPL && fetchedBNPLPlans.length === 0 && paymentOption.BNPL && (
                            <Text style={styles.noPlansText}> No Published BNPL plans available. </Text>
                       )}
                      </>
                 )}

                {/* --- Action Buttons --- */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton, buttonLoading && styles.disabledOpacity]}
                        onPress={onDismiss}
                        disabled={buttonLoading}
                        accessibilityLabel="Cancel product changes"
                        accessibilityState={{ disabled: buttonLoading }}
                    >
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton, buttonLoading && styles.disabledButton]}
                        onPress={handleSubmit}
                        disabled={buttonLoading}
                        accessibilityLabel={isEditMode ? "Update product" : "Save new product"}
                        accessibilityState={{ disabled: buttonLoading }}
                    >
                        {buttonLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{isEditMode ? 'Update Product' : 'Save Product'}</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* --- Preview Modals (Outside ScrollView) --- */}
            {imagePreview && (
                 <PreviewModal
                     visible={!!imagePreview}
                     transparent={true}
                     animationType="fade"
                     onRequestClose={closePreview} // Handle back button press on Android
                 >
                     <View style={styles.modalContainer}>
                         {/* --- MODIFICATION START ---
                             Removed potential whitespace/newline between TouchableOpacity and Image
                           --- MODIFICATION END --- */}
                         <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton} accessibilityLabel="Close image preview"><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Image source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" accessibilityLabel="Full size image preview"/>
                     </View>
                 </PreviewModal>
            )}
            {videoPreview && (
                 <PreviewModal
                     visible={!!videoPreview}
                     transparent={true}
                     animationType="fade"
                     onRequestClose={closePreview} // Handle back button press on Android
                 >
                     <View style={styles.modalContainer}>
                         {/* --- MODIFICATION START ---
                             Removed potential whitespace/newline between TouchableOpacity and Video
                           --- MODIFICATION END --- */}
                          <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton} accessibilityLabel="Close video preview"><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Video
                            source={{ uri: videoPreview }}
                            style={styles.previewVideo}
                            useNativeControls // Enable native player controls
                            resizeMode="contain"
                            shouldPlay={true} // Auto-play video
                            onError={(err) => {
                                console.error("Video Preview Error:", err);
                                Alert.alert("Video Error", "Could not load the video for preview.");
                                closePreview(); // Close modal on error
                            }}
                            accessibilityLabel="Video preview player"
                         />
                     </View>
                 </PreviewModal>
             )}

        </View>
    );
};

// PropTypes for component props validation
UploadProductComponent.propTypes = {
    visible: PropTypes.bool.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    productForEdit: PropTypes.object, // Can be null or undefined for 'Add' mode
};

// Styles remain the same
const styles = StyleSheet.create({
    componentRoot: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
        flexGrow: 1,
        padding: 15,
        backgroundColor: '#fff',
        paddingBottom: 50, // Ensure space below buttons
    },
    // Removed loaderContainer style as it wasn't used
    loadingContainer: { // Used for BNPL/Category loading
        alignItems: 'center',
        marginVertical: 20,
        padding: 10,
    },
    loadingText: { // Used for BNPL/Category loading text
        marginTop: 10,
        color: '#555', // Adjusted color for better visibility on white bg
        fontSize: 16
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'center', // Center title
        alignItems: 'center',
        marginBottom: 20, // Increased spacing
        paddingTop: Platform.OS === 'ios' ? 45 : 15, // Safe area for iOS notch
        paddingBottom: 10, // Spacing below title
        position: 'relative',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        flex: 1, // Allow title to take space for centering
        marginHorizontal: 50, // Ensure space for close button
    },
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 40 : 10,
        right: 5, // Closer to edge
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        padding: 5,
        borderRadius: 25, // Fully round
        zIndex: 10, // Ensure it's above other elements
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
        marginTop: 12,
    },
    submitErrorText: { // Style for the main submit error HelperText
        marginBottom: 15,
        paddingVertical: 8,
        paddingHorizontal: 12,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#B00020',
        backgroundColor: '#fdecea',
        borderWidth: 1,
        borderColor: '#B00020',
        borderRadius: 4,
    },
    inputField: {
        marginBottom: 10,
        backgroundColor: '#fff', // Ensure bg color for outlined inputs
    },
    descriptionInput: {
        height: 100,
        textAlignVertical: 'top', // Good practice for multiline
    },
    errorTextAbove: { // For HelperText errors above inputs
        paddingBottom: 0,
        marginBottom: 2,
        paddingLeft: 2,
        fontSize: 12,
        color: '#B00020', // Material Design error color
    },
    infoText: { // For non-error HelperText
        paddingBottom: 0,
        marginBottom: 2,
        paddingLeft: 2,
        fontSize: 12,
        color: '#00529B', // Informational blue
        marginTop: -8 // Adjust spacing if needed
    },
    warningText: { // For non-critical warnings (like no categories)
        fontSize: 13,
        color: '#ff8c00', // Orange/yellow for warnings
        textAlign: 'center',
        marginVertical: 5,
        paddingHorizontal: 10,
    },
    pickerContainer: {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'grey', // Default border color
        backgroundColor: '#fff',
        marginBottom: 12,
        overflow: 'hidden', // Needed on Android for border radius
        minHeight: 50, // Ensure consistent height
        justifyContent: 'center',
    },
    picker: {
        color: '#000', // Text color inside picker
        height: 55,
        width: '100%',
    },
    pickerPlaceholder: {
        color: '#999', // Style for the placeholder item
    },
    pickerErrorBorder: {
        borderColor: '#B00020', // Red border on error
        borderWidth: 1.5,
    },
    inlineLoader: { // For small loaders next to labels
        alignSelf: 'center',
        marginVertical: 10,
    },
    mediaButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 15,
        marginTop: 5,
    },
    selectMediaButton: {
        backgroundColor: '#FF0000', // Primary action color
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1, // Take equal space
        marginHorizontal: 5, // Spacing between buttons
        justifyContent: 'center',
        minHeight: 45,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
    },
    selectMediaText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    buttonIcon: { // Icon inside buttons
        marginRight: 8,
    },
    mediaHint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
        marginTop: 0,
        paddingHorizontal: 10,
    },
    mediaPreviewContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
        marginTop: 5,
    },
    mediaPreviewWrapper: {
        marginRight: 10,
        marginBottom: 10,
    },
    mediaPreview: {
        position: 'relative',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        overflow: 'hidden', // Clip image/video to border radius
        backgroundColor: '#eee', // Placeholder bg
        width: 80, // Size of the preview square
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    mediaVideoPlaceholder: { // Used as bg for video preview tile
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadIndicator: { // Common style for status overlay
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingVertical: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newIndicator: { // 'New' overlay style
        backgroundColor: 'rgba(255, 165, 0, 0.8)', // Orange-ish
    },
    uploadedIndicator: { // 'Uploaded' overlay style
        backgroundColor: 'rgba(0, 128, 0, 0.7)', // Green-ish
    },
    uploadIndicatorText: { // Text inside the 'New' overlay
        color: '#fff',
        fontSize: 10,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    removeMediaButton: { // The small 'x' button
        position: 'absolute',
        top: -8, right: -8, // Position slightly outside the top-right corner
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent black
        borderRadius: 15, // Circular background
        padding: 3,
        zIndex: 1, // Ensure it's above the media preview
    },
    paymentOptions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 15,
        marginTop: 5,
    },
    paymentOptionButton: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#f0f1f1', // Light grey default bg
        flex: 1, // Take equal space
        marginHorizontal: 5, // Spacing
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ddd', // Light border
        minHeight: 50,
    },
    paymentOptionErrorBorder: { // Not directly used, parent container gets error border
       // If needed, apply to paymentOptions View: borderColor: '#B00020', borderWidth: 1.5,
    },
    paymentOptionText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#444', // Default text color
    },
    selectedPaymentOption: { // Style when option is selected
        borderColor: '#FF0000', // Highlight border
        backgroundColor: '#fff', // White background
        borderWidth: 1.5, // Thicker border
    },
    selectedPaymentOptionText: { // Text style when option is selected
        color: '#FF0000', // Highlight text color
    },
    bnplListContainer: {
        marginBottom: 15,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e0e0e0', // Default border
        overflow: 'hidden',
        backgroundColor: '#fdfdfd', // Slightly off-white bg
    },
    bnplContainerErrorBorder: { // Style for error on the container
        borderColor: '#B00020',
        borderWidth: 1.5,
    },
    selectAllContainer: { // Special style for the 'Select All' row
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        backgroundColor: '#f0f0f0', // Different bg for distinction
    },
    planItem: { // Style for each BNPL plan row
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee', // Separator line
        backgroundColor: '#fff',
    },
    selectedPlan: { // Highlight style for selected plan row
        backgroundColor: '#ffebee', // Light red/pink highlight
        borderColor: '#ffcdd2', // Matching border
        borderWidth: 1,
        marginHorizontal: -1, // Adjust to align with container border
        borderBottomColor: '#ffcdd2', // Ensure separator matches
    },
    checkbox: { // Container for the checkbox icon
        width: 24,
        height: 24,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    planDetails: { // Container for plan text details
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap', // Allow wrapping if content is too long
    },
    planText: { // Plan Name
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
        flexShrink: 1, // Allow text to shrink if needed
        marginRight: 5, // Space before other details
    },
    planType: { // Plan Type (e.g., "Standard")
        fontSize: 13,
        color: '#666',
        fontStyle: 'italic',
        marginHorizontal: 5,
    },
    planDuration: { // Plan Duration (e.g., "3 Months") - Currently commented out in JSX
        fontSize: 13,
        fontWeight: '500',
        color: '#444',
        marginHorizontal: 5,
    },
    planInterest: { // Plan Interest Rate
        fontSize: 13,
        fontWeight: '500',
        color: '#555',
        marginLeft: 'auto', // Push to the right
        paddingLeft: 8, // Space from other elements if they wrap
    },
    selectAllPlansText: { // Text for "Select/Deselect All"
        fontSize: 15,
        fontWeight: '600',
        color: '#FF0000', // Match primary color
    },
    noPlansText: { // Message when no BNPL plans are available
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginTop: 15,
        marginBottom: 15,
        fontStyle: 'italic',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 25,
        borderTopWidth: 1, // Separator line above buttons
        borderTopColor: '#eee',
        paddingTop: 15,
        paddingBottom: 10, // Bottom padding
    },
    button: { // Common style for Save/Cancel buttons
        flex: 1, // Take equal width
        paddingVertical: 14,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row', // For loader alignment
        minHeight: 50,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
    cancelButton: {
        backgroundColor: '#6c757d', // Grey for cancel
        marginRight: 10, // Space between buttons
    },
    saveButton: {
        backgroundColor: '#FF0000', // Primary color for save
        marginLeft: 10, // Space between buttons
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    disabledButton: { // Style for disabled save button
        backgroundColor: '#ff9999', // Lighter red
        opacity: 0.8,
        elevation: 0, // Remove shadow when disabled
        shadowOpacity: 0,
    },
    disabledOpacity: { // General opacity for disabled touchables
        opacity: 0.6,
    },
    // --- Preview Modal Styles ---
    modalContainer: { // The dark background overlay
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)', // Dark semi-transparent
    },
    modalCloseButton: { // Close button within the modal
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30, // Adjust for status bar/notch
        right: 15,
        zIndex: 1, // Ensure it's above the image/video
        backgroundColor: 'rgba(0,0,0,0.4)', // Make it visible on light/dark parts of media
        padding: 8,
        borderRadius: 25, // Circular
    },
    previewImage: { // Style for the large preview image
        width: '95%', // Almost full width
        height: '80%', // Large portion of height
    },
    previewVideo: { // Style for the large preview video
        width: '95%',
        height: '80%',
        backgroundColor: '#000', // Black bg for video player area
    },
});

export default UploadProductComponent;