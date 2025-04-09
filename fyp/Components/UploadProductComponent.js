// ****** UploadProductComponent.js (Updated) ******

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
    Alert, Modal, Image, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import { TextInput as PaperInput, HelperText } from 'react-native-paper';
import PropTypes from 'prop-types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './../firebaseConfig';

// --- Mock Upload Functions (Keep as is or replace) ---
const uploadImage = async (uri) => {
    console.log("Simulating image upload for:", uri.substring(0, 60) + "...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUrl = `https://res.cloudinary.com/demo/image/upload/sample_${Date.now()}.jpg`;
    console.log("Simulated image upload success:", mockUrl);
    return { cloudinaryUrl: mockUrl };
};

const uploadVideo = async (uri) => {
    console.log("Simulating video upload for:", uri.substring(0, 60) + "...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    const mockUrl = `https://res.cloudinary.com/demo/video/upload/dog_${Date.now()}.mp4`;
    console.log("Simulated video upload success:", mockUrl);
    return { cloudinaryUrl: mockUrl };
};
// --- End Mock Upload Functions ---

const MEDIA_TYPES = { IMAGE: 'image', VIDEO: 'video' };
const PAYMENT_OPTIONS = { COD: 'COD', BNPL: 'BNPL' };
const MAX_IMAGES = 3;
const MAX_IMAGES_WITH_VIDEO = 2;
const MAX_VIDEOS = 1;

const UploadProductComponent = ({ visible, onDismiss, onSave, product }) => {
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

    const prevVisible = useRef(visible);
    const prevProductId = useRef(product?.id);
    const prevProductRef = useRef(product);

    // --- Fetch Categories (Keep as is) ---
    useEffect(() => {
        const fetchCategories = async () => {
            if (!visible || fetchedCategories.length > 0) {
                setLoadingCategories(false);
                return;
            }
            console.log("UploadProductComponent: Fetching categories...");
            setLoadingCategories(true);
            try {
                const querySnapshot = await getDocs(collection(db, 'Category'));
                const categoriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setFetchedCategories(categoriesData);
                console.log("UploadProductComponent: Categories fetched:", categoriesData.length);
            } catch (error) {
                console.error("UploadProductComponent: Error fetching categories: ", error);
                Alert.alert("Error", "Could not fetch categories. Please try again.");
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();
    }, [visible, fetchedCategories.length]);


    // --- Initialize/Reset Form State ---
    // *** <<<=== CHANGED DEPENDENCY ARRAY HERE ===>>> ***
    useEffect(() => {
        const isOpening = visible && !prevVisible.current;
        const productChanged = visible && (
            product !== prevProductRef.current ||
            (product?.id !== prevProductId.current)
        );

        if (isOpening || productChanged) {
            console.log(`UploadProductComponent: Running Initialization Effect - Reason: ${isOpening ? 'Modal Opened' : ''}${productChanged ? ` Product Changed (Prev: ${prevProductId.current}, New: ${product?.id})` : ''}`);
            setSubmitAttempted(false);
            setButtonLoading(false);
            setFormErrors({});

            if (product) {
                console.log("UploadProductComponent: Initializing form for EDITING product:", product.id);
                 // --- Log the product data being used for initialization ---
                 console.log("Initializing with data:", JSON.stringify(product, null, 2));
                 // --- End log ---
                setProductName(product.name || '');
                setCategory(product.category || '');
                setDescription(product.description || '');
                setOriginalPrice(product.originalPrice?.toString() || '');
                // Handle null or undefined discountedPrice explicitly
                setDiscountedPrice(product.discountedPrice != null ? product.discountedPrice.toString() : '');

                const initialImages = (Array.isArray(product.media?.images) ? product.media.images : [])
                    .filter(url => typeof url === 'string' && url.trim() !== '')
                    .map(url => ({ uri: url, isUploaded: true }));
                const initialVideo = (product.media?.video && typeof product.media.video === 'string' && product.media.video.trim() !== '')
                    ? { uri: product.media.video, isUploaded: true }
                    : null;
                setMedia({ images: initialImages, video: initialVideo });

                const initialPaymentOption = {
                    COD: product.paymentOption?.COD ?? true,
                    BNPL: product.paymentOption?.BNPL ?? false,
                };
                setPaymentOption(initialPaymentOption);

                if (initialPaymentOption.BNPL) {
                    // Pass true flag to handlePaymentOptionChange ONLY if plans need fetching
                    const plansNeedFetching = fetchedBNPLPlans.length === 0;
                    const isInitialLoadForEdit = true; // Mark this as initial load

                    if (!plansNeedFetching) {
                         // Plans already fetched, set selected plans directly
                         const validSelectedPlans = (Array.isArray(product.BNPLPlans) ? product.BNPLPlans : [])
                             .filter(planId => fetchedBNPLPlans.some(p => p.id === planId));
                         setSelectedPlans(validSelectedPlans);
                         setSelectAll(fetchedBNPLPlans.length > 0 && validSelectedPlans.length === fetchedBNPLPlans.length);
                         console.log("UploadProductComponent: Initializing BNPL plans for edit (plans already fetched):", validSelectedPlans);
                    } else {
                         // Plans need fetching, clear state and trigger fetch via handlePaymentOptionChange
                         setSelectedPlans([]);
                         setSelectAll(false);
                         console.log("UploadProductComponent: BNPL selected for edit, plans not fetched yet. Triggering fetch via handlePaymentOptionChange.");
                         // Call handlePaymentOptionChange, which will fetch and then set plans
                         // Need to ensure handlePaymentOptionChange is stable or memoized if called here
                         // It's generally safer to let handlePaymentOptionChange run based on paymentOption state change
                         // Let's trigger it indirectly by ensuring paymentOption is set correctly above
                         // And handle the plan setting *inside* handlePaymentOptionChange when plans arrive
                         // We might need to call it explicitly if the paymentOption isn't actually changing state here
                         // Let's call it explicitly but ensure it handles the isInitialLoadForEdit correctly
                         handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL, isInitialLoadForEdit);
                    }

                } else {
                    setSelectedPlans([]);
                    setSelectAll(false);
                }
            } else {
                console.log("UploadProductComponent: Initializing form for NEW product (Resetting).");
                setProductName('');
                setCategory('');
                setDescription('');
                setOriginalPrice('');
                setDiscountedPrice('');
                setMedia({ images: [], video: null });
                setPaymentOption({ [PAYMENT_OPTIONS.COD]: true, [PAYMENT_OPTIONS.BNPL]: false });
                setSelectedPlans([]);
                setSelectAll(false);
            }
        }
        prevVisible.current = visible;
        prevProductId.current = product?.id;
        prevProductRef.current = product;

    // Simplified Dependency Array: Runs when modal visibility changes or the product prop changes.
    // We pass handlePaymentOptionChange here because it's used within the effect logic *conditionally*
    // and needs to be stable or included if its definition relies on outside scope that changes.
    // Let's try keeping handlePaymentOptionChange to ensure it's available if needed inside.
    }, [visible, product, fetchedBNPLPlans.length, handlePaymentOptionChange]);

    // --- Handle Payment Option Toggle (Keep as is, relies on state changes) ---
    // Memoized version of handlePaymentOptionChange (Add this if not already memoized like this)
    const handlePaymentOptionChangeStable = useCallback(async (option, isInitialLoadForEdit = false) => {
        // ... (rest of the handlePaymentOptionChange logic from your previous code) ...
        console.log(`UploadProductComponent: Handling payment option change for: ${option}. Initial load for edit: ${isInitialLoadForEdit}`);
        const currentOptions = { ...paymentOption };
        const wantsToSelect = !currentOptions[option];
        const newPaymentOptions = { ...paymentOption, [option]: wantsToSelect };
        setPaymentOption(newPaymentOptions);
        console.log("UploadProductComponent: Updated payment options state:", newPaymentOptions);

        if (submitAttempted) {
            const atLeastOneSelected = newPaymentOptions.COD || newPaymentOptions.BNPL;
             setFormErrors(prev => ({
                 ...prev,
                 paymentOption: atLeastOneSelected ? null : 'At least one payment option must be selected.'
             }));
        }

        if (option === PAYMENT_OPTIONS.BNPL) {
            if (wantsToSelect) {
                 console.log("UploadProductComponent: BNPL option ENABLED.");
                 const needsFetching = fetchedBNPLPlans.length === 0;

                 if (needsFetching) {
                    console.log("UploadProductComponent: Fetching BNPL plans...");
                    setLoadingBNPL(true);
                    setSelectedPlans([]);
                    setSelectAll(false);
                    try {
                        const querySnapshot = await getDocs(collection(db, 'BNPL_plans'));
                        const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setFetchedBNPLPlans(plansData);
                        console.log("UploadProductComponent: BNPL Plans fetched:", plansData.length);

                        // Now, *after* fetching, set the plans if it was for initial edit load
                        if (isInitialLoadForEdit && product?.BNPLPlans) {
                            const validInitialPlanIds = (Array.isArray(product.BNPLPlans) ? product.BNPLPlans : [])
                                .filter(planId => plansData.some(p => p.id === planId));

                            if (Array.isArray(product.BNPLPlans) && validInitialPlanIds.length !== product.BNPLPlans.length) {
                                console.warn("UploadProductComponent: Some initial BNPL Plan IDs were invalid or not found in fetched plans and were ignored.", product.BNPLPlans);
                            }
                            setSelectedPlans(validInitialPlanIds);
                            setSelectAll(plansData.length > 0 && validInitialPlanIds.length === plansData.length);
                            console.log("UploadProductComponent: Set initial BNPL plans for editing (after fetch):", validInitialPlanIds);

                            if (submitAttempted) {
                                setFormErrors(prev => ({ ...prev, bnplPlans: validInitialPlanIds.length > 0 ? null : 'Please select at least one BNPL plan.' }));
                            }
                        } else {
                            // If not initial edit load OR no initial plans, keep empty / reset validation
                            setSelectedPlans([]);
                            setSelectAll(false);
                             if (submitAttempted) {
                                 setFormErrors(prev => ({ ...prev, bnplPlans: 'Please select at least one BNPL plan.' }));
                             }
                        }
                    } catch (error) {
                        console.error("UploadProductComponent: Error fetching BNPL plans: ", error);
                        Alert.alert("Error", "Could not fetch BNPL plans. BNPL option disabled.");
                        setPaymentOption(prev => ({ ...prev, BNPL: false }));
                        setFetchedBNPLPlans([]);
                        setSelectedPlans([]);
                        setSelectAll(false);
                        if (submitAttempted) {
                            setFormErrors(prev => ({
                                ...prev,
                                paymentOption: prev.COD ? null : 'At least one payment option must be selected.',
                                bnplPlans: null
                            }));
                        }
                    } finally {
                        setLoadingBNPL(false);
                    }
                 } else { // Plans were already fetched
                     if (!isInitialLoadForEdit) {
                        // Only reset if NOT the initial load for edit (initial load sets plans above)
                        setSelectedPlans([]);
                        setSelectAll(false);
                     }
                     console.log("UploadProductComponent: BNPL enabled, plans already loaded.");
                     if (submitAttempted) {
                         // Validate based on potentially pre-existing selectedPlans for edit mode
                         const plansToCheck = isInitialLoadForEdit ? (product?.BNPLPlans || []) : selectedPlans;
                         const validSelectedPlans = (Array.isArray(plansToCheck) ? plansToCheck : [])
                             .filter(planId => fetchedBNPLPlans.some(p => p.id === planId));

                         setFormErrors(prev => ({
                             ...prev,
                             bnplPlans: validSelectedPlans.length === 0 ? 'Please select at least one BNPL plan.' : null
                         }));
                     }
                 }
            } else { // Disabling BNPL
                console.log("UploadProductComponent: BNPL option DISABLED.");
                setSelectedPlans([]);
                setSelectAll(false);
                setLoadingBNPL(false);
                if (submitAttempted) {
                    setFormErrors(prev => ({ ...prev, bnplPlans: null }));
                }
            }
        }
    // Make dependencies reflect what's used *inside* this specific callback
    // product is used indirectly via isInitialLoadForEdit logic
    }, [paymentOption, submitAttempted, fetchedBNPLPlans.length, product]); // Use stable function

    // Assign the stable function (if needed, otherwise keep original name)
    const handlePaymentOptionChange = handlePaymentOptionChangeStable;


    // --- Rest of the component (Validation, Input Handlers, Media Handlers, Submit, Render) ---
    // --- Keep the rest of your functions (validateForm, handleInputChange, togglePlanSelection, etc.) exactly as they were ---
    // --- Keep the JSX return statement exactly as it was ---

    // --- Form Validation ---
    const validateForm = useCallback((showErrors = false) => {
        const errors = {};
        if (!productName.trim()) errors.productName = 'Product Name is required.';
        if (!description.trim()) errors.description = 'Description is required.';
        if (!category) errors.category = 'Category is required.';

        const origPriceNum = Number(originalPrice);
        const discPriceNum = Number(discountedPrice);
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

        if (media.images.length === 0) errors.media = 'At least one image is required.';
        if (!paymentOption.COD && !paymentOption.BNPL) errors.paymentOption = 'At least one payment option must be selected.';
        // Ensure BNPL plans are fetched before validating their selection
        if (paymentOption.BNPL && !loadingBNPL && fetchedBNPLPlans.length > 0 && selectedPlans.length === 0) {
             errors.bnplPlans = 'Please select at least one BNPL plan if BNPL option is enabled.';
        } else if (paymentOption.BNPL && !loadingBNPL && fetchedBNPLPlans.length === 0) {
            // If BNPL is on but no plans could be loaded, maybe don't block submission? Or show different error?
             console.warn("Validation: BNPL selected but no plans available/loaded.");
             // Decide if this is an error: errors.bnplPlans = 'No BNPL plans available to select.';
        }


        if (showErrors) {
          setFormErrors(errors);
        }
        const isValid = Object.keys(errors).length === 0;
        if (!isValid) {
            console.log("UploadProductComponent: Validation failed. Errors:", errors);
        }
        return isValid;
    }, [productName, description, category, originalPrice, discountedPrice, media.images, paymentOption.COD, paymentOption.BNPL, selectedPlans, loadingBNPL, fetchedBNPLPlans.length]);


    // --- Handle Input Changes ---
    const handleInputChange = useCallback((setter, fieldName) => (value) => {
        setter(value);
        if (submitAttempted) {
            validateForm(true);
        }
    }, [submitAttempted, validateForm]);


    // --- Handle BNPL Plan Selection ---
    const togglePlanSelection = useCallback((planId) => {
        setSelectedPlans((prevPlans) => {
            const newSelectedPlans = prevPlans.includes(planId)
                ? prevPlans.filter((id) => id !== planId)
                : [...prevPlans, planId];
            setSelectAll(fetchedBNPLPlans.length > 0 && newSelectedPlans.length === fetchedBNPLPlans.length);
            if (submitAttempted && paymentOption.BNPL) {
                 setFormErrors(prev => ({ ...prev, bnplPlans: newSelectedPlans.length === 0 ? 'Please select at least one BNPL plan.' : null }));
            }
            return newSelectedPlans;
        });
    }, [submitAttempted, paymentOption.BNPL, fetchedBNPLPlans.length]);


    // --- Handle Select/Deselect All BNPL Plans ---
    const toggleSelectAllPlans = useCallback(() => {
        const newSelectAllState = !selectAll;
        let newSelectedPlans = [];
        if (newSelectAllState) {
            newSelectedPlans = fetchedBNPLPlans.map((plan) => plan.id);
        }
        setSelectedPlans(newSelectedPlans);
        setSelectAll(newSelectAllState);
        if (submitAttempted && paymentOption.BNPL) {
           setFormErrors(prev => ({ ...prev, bnplPlans: newSelectedPlans.length === 0 ? 'Please select at least one BNPL plan.' : null }));
        }
    }, [selectAll, fetchedBNPLPlans, submitAttempted, paymentOption.BNPL]);


    // --- Media Handling Functions (Permissions, Picker, Camera, Remove, Limits) ---
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
                Alert.alert('Image Limit Exceeded', `Cannot add video. You have ${currentImages} images (max ${MAX_IMAGES_WITH_VIDEO} allowed with video). Please remove images first.`);
                return false;
            }
        }
        return true;
    }, [media]);

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
             Alert.alert('Permission Error', `Could not request ${permissionType} permissions. Please check your app settings.`);
            return false;
        }
    }, []);

    const pickMediaFromLibrary = useCallback(async (type) => {
       if (!(await requestPermissions('library'))) return;
        const isImage = type === MEDIA_TYPES.IMAGE;
        const mediaTypesOption = isImage ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos;
        const remainingImageSlots = (media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES) - media.images.length;
        const selectionLimit = isImage ? Math.max(0, remainingImageSlots) : (media.video ? 0 : 1);

        if (!checkMediaLimits(type, 1)) return;
        if (isImage && selectionLimit <= 0) { Alert.alert('Limit Reached', `You have already reached the maximum number of images allowed.`); return; }
        if (!isImage && selectionLimit <= 0) { Alert.alert('Limit Reached', `You already have a video selected.`); return; }

        try {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: mediaTypesOption, allowsMultipleSelection: isImage, selectionLimit: isImage ? selectionLimit : 1, quality: isImage ? 0.8 : 1 });
          if (result.canceled) return;

          if (result.assets && result.assets.length > 0) {
              let addedCount = 0;
              if (isImage) {
                  const validNewImages = result.assets.filter(asset => asset.uri && typeof asset.uri === 'string').slice(0, selectionLimit);
                  if (validNewImages.length !== result.assets.length) {
                      if(result.assets.length > selectionLimit) { Alert.alert("Limit Exceeded", `You selected ${result.assets.length} images, but only ${selectionLimit} could be added due to the limit.`); }
                      else if (validNewImages.length < result.assets.length) { Alert.alert("Invalid Media", "Some selected images could not be processed (missing URI)."); }
                  }
                  if (validNewImages.length > 0) {
                     addedCount = validNewImages.length;
                     setMedia(prevMedia => ({ ...prevMedia, images: [...prevMedia.images, ...validNewImages.map(asset => ({ uri: asset.uri, isUploaded: false }))] }));
                  }
              } else {
                  const videoAsset = result.assets[0];
                  if (videoAsset?.uri && typeof videoAsset.uri === 'string') {
                     if (checkMediaLimits(MEDIA_TYPES.VIDEO, 1)) {
                        addedCount = 1;
                        setMedia(prevMedia => ({ ...prevMedia, video: { uri: videoAsset.uri, isUploaded: false } }));
                     }
                  } else { Alert.alert("Invalid Video", "The selected video file could not be processed (missing URI)."); }
              }
              if(addedCount > 0) {
                 if (submitAttempted) { setFormErrors(prev => ({ ...prev, media: null })); }
              }
          }
        } catch (error) { Alert.alert('Error', 'Could not open media library. Please try again.'); }
    }, [media, submitAttempted, requestPermissions, checkMediaLimits]);

    const captureMediaWithCamera = useCallback(async (type) => {
      if (!(await requestPermissions('camera'))) return;
      const isImage = type === MEDIA_TYPES.IMAGE;
      const mediaTypesOption = isImage ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos;
      if (!checkMediaLimits(type, 1)) return;

      try {
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: mediaTypesOption, allowsEditing: false, quality: isImage ? 0.8 : 1 });
          if (result.canceled) return;

          if (result.assets && result.assets.length > 0) {
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
                   if (added) { if (submitAttempted) { setFormErrors(prev => ({ ...prev, media: null })); } }
                   else { Alert.alert("Limit Reached", `Could not add the captured ${type} due to media limits.`); }
               } else { Alert.alert("Capture Error", "The captured media could not be processed (missing URI)."); }
          }
      } catch (error) { Alert.alert('Error', 'Could not open camera. Please try again.'); }
    }, [media, submitAttempted, requestPermissions, checkMediaLimits]);

    const showMediaSourceOptions = useCallback((type) => {
        const title = type === MEDIA_TYPES.IMAGE ? "Select Image Source" : "Select Video Source";
        const options = [
            { text: "Choose from Gallery", onPress: () => pickMediaFromLibrary(type) },
            ...(Platform.OS !== 'web' ? [{ text: "Use Camera", onPress: () => captureMediaWithCamera(type) }] : []),
            { text: "Cancel", style: "cancel" },
        ];
        Alert.alert(title, "", options);
    }, [pickMediaFromLibrary, captureMediaWithCamera]);

    const removeMedia = useCallback((index, type) => {
        const mediaIdentifier = type === MEDIA_TYPES.IMAGE ? `image at index ${index}` : 'video';
        Alert.alert(
           "Remove Media", `Are you sure you want to remove this ${mediaIdentifier}?`,
           [
               { text: "Cancel", style: "cancel" },
               { text: "Remove", style: "destructive", onPress: () => {
                       setMedia(prevMedia => {
                            let updatedMedia = { images: [...prevMedia.images], video: prevMedia.video ? { ...prevMedia.video } : null };
                            let removed = false;
                            if (type === MEDIA_TYPES.IMAGE) {
                                if (index >= 0 && index < updatedMedia.images.length) {
                                   updatedMedia.images = updatedMedia.images.filter((_, i) => i !== index);
                                   removed = true;
                                } else { return prevMedia; }
                            } else if (type === MEDIA_TYPES.VIDEO) {
                                if (updatedMedia.video) { updatedMedia.video = null; removed = true; }
                            }
                            if (removed && submitAttempted) {
                                 setFormErrors(prevErr => ({ ...prevErr, media: updatedMedia.images.length > 0 ? null : 'At least one image is required.' }));
                            }
                            return updatedMedia;
                       });
                   }
               }
           ]
       );
    }, [submitAttempted]);

    const handleImagePreview = useCallback((uri) => { if (uri && typeof uri === 'string') setImagePreview(uri); }, []);
    const handleVideoPreview = useCallback((uri) => { if (uri && typeof uri === 'string') setVideoPreview(uri); }, []);
    const closePreview = useCallback(() => { setImagePreview(null); setVideoPreview(null); }, []);


    // --- Handle Form Submission ---
    const handleSubmit = useCallback(async () => {
        setSubmitAttempted(true);
        if (!validateForm(true)) {
            Alert.alert('Validation Error', 'Please review the form and fix the indicated errors before saving.');
            return;
        }
        setButtonLoading(true);
        setFormErrors({});

        try {
            const newImagesToUpload = media.images.filter(img => !img.isUploaded && img.uri);
            const existingImageUrls = media.images.filter(img => img.isUploaded && img.uri).map(img => img.uri);
            const uploadImagePromises = newImagesToUpload.map(image => uploadImage(image.uri));
            const uploadedImageResults = await Promise.all(uploadImagePromises);
            const uploadedImageUrls = uploadedImageResults.map((result, index) => {
                if (!result?.cloudinaryUrl) throw new Error(`An image upload failed. Please check logs or retry.`);
                return result.cloudinaryUrl;
            });
            const finalImageUrls = [...existingImageUrls, ...uploadedImageUrls];
            if (finalImageUrls.length === 0) throw new Error("Submission failed: At least one valid image is required.");

            let finalVideoUrl = media.video?.isUploaded ? media.video.uri : null;
            if (media.video && !media.video.isUploaded) {
                 if (media.video.uri && typeof media.video.uri === 'string') {
                     const videoResult = await uploadVideo(media.video.uri);
                     if (videoResult?.cloudinaryUrl) { finalVideoUrl = videoResult.cloudinaryUrl; }
                     else { throw new Error("Video upload failed. Please check logs or retry."); }
                 }
            }

            const origPrice = Number(originalPrice);
            const discPrice = discountedPrice.trim() ? Number(discountedPrice) : null;
            const finalDiscountedPrice = (discPrice !== null && !isNaN(discPrice) && discPrice >= 0 && discPrice < origPrice) ? discPrice : null; // Allow 0
            const finalPrice = finalDiscountedPrice !== null ? finalDiscountedPrice : origPrice;

            const productData = {
                ...(product?.id && { id: product.id }),
                name: productName.trim(),
                category: category,
                description: description.trim(),
                originalPrice: origPrice,
                discountedPrice: finalDiscountedPrice,
                price: finalPrice,
                media: { images: finalImageUrls, video: finalVideoUrl },
                paymentOption: paymentOption,
                BNPLPlans: paymentOption.BNPL ? selectedPlans : [],
            };

            await onSave(productData);
            Alert.alert("Success", `Product ${product ? 'updated' : 'uploaded'} successfully!`);

        } catch (error) {
             const isUploadFailure = error.message?.includes("upload failed");
             const isValidationMsg = error.message?.startsWith("Submission failed:");
             let displayMessage = `Failed to save product. ${error.message || 'An unexpected error occurred.'}`;
             if (isUploadFailure) { displayMessage = `Media upload failed: ${error.message}. Please try again.`; }
             else if (isValidationMsg){ displayMessage = error.message; }
             setFormErrors({ submit: displayMessage });
             Alert.alert('Submission Error', displayMessage);
        } finally {
            setButtonLoading(false);
        }
    }, [
        product, productName, category, description, originalPrice, discountedPrice,
        media, paymentOption, selectedPlans, validateForm, onSave
    ]);


    // --- Render Logic ---
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

     if (loadingCategories && !product && visible && fetchedCategories.length === 0) {
        return (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF0000" />
            <Text>Loading Setup...</Text>
          </View>
        );
     }

    return (
        <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity style={styles.closeButton} onPress={onDismiss} disabled={buttonLoading}>
                <Icon name="close-circle" size={30} color="white" />
            </TouchableOpacity>

             {formErrors.submit && (
                 <HelperText type="error" visible={true} style={styles.submitErrorText}>
                     {formErrors.submit}
                 </HelperText>
             )}

            <Text style={styles.label}>Product Media</Text>
            {renderFieldError('media')}
            <View style={styles.mediaPreviewContainer}>
                {media.images.map((img, index) => (
                    <TouchableOpacity
                        key={`${img.uri}-${index}`}
                        onPress={() => handleImagePreview(img.uri)}
                        disabled={buttonLoading}
                        style={styles.mediaPreviewWrapper}
                    >
                        <View style={styles.mediaPreview}>
                            <Image
                                source={{ uri: img.uri }}
                                style={styles.mediaImage}
                                onError={(e) => console.warn(`Failed to load image preview for index ${index}:`, e.nativeEvent.error)}
                            />
                            {!img.isUploaded && <View style={styles.uploadIndicator}><Text style={styles.uploadIndicatorText}>New</Text></View>}
                            <TouchableOpacity onPress={() => removeMedia(index, MEDIA_TYPES.IMAGE)} style={styles.removeMediaButton} disabled={buttonLoading}>
                                <Icon name="close-circle" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
                {media.video && (
                    <TouchableOpacity
                        key={media.video.uri}
                        onPress={() => handleVideoPreview(media.video.uri)}
                        disabled={buttonLoading}
                        style={styles.mediaPreviewWrapper}
                    >
                        <View style={styles.mediaPreview}>
                            <View style={styles.mediaVideoPlaceholder}>
                                <Icon name="play-circle-outline" size={40} color="#FFF" />
                            </View>
                            {!media.video.isUploaded && <View style={styles.uploadIndicator}><Text style={styles.uploadIndicatorText}>New</Text></View>}
                            <TouchableOpacity onPress={() => removeMedia(null, MEDIA_TYPES.VIDEO)} style={styles.removeMediaButton} disabled={buttonLoading}>
                                <Icon name="close-circle" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.mediaButtonContainer}>
                <TouchableOpacity
                    onPress={() => showMediaSourceOptions(MEDIA_TYPES.IMAGE)}
                    style={[styles.selectMediaButton, (isImageLimitReached || buttonLoading) && styles.disabledOpacity]}
                    disabled={isImageLimitReached || buttonLoading}
                >
                    <Icon name="image-plus" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.selectMediaText}>Add Image ({media.images.length}/{imageLimit})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => showMediaSourceOptions(MEDIA_TYPES.VIDEO)}
                    style={[styles.selectMediaButton, (isVideoLimitReached || buttonLoading || media.images.length > MAX_IMAGES_WITH_VIDEO) && styles.disabledOpacity]}
                    disabled={isVideoLimitReached || buttonLoading || media.images.length > MAX_IMAGES_WITH_VIDEO}
                >
                    <Icon name="video-plus" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.selectMediaText}>Add Video</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.mediaHint}>Max {MAX_IMAGES} images OR {MAX_IMAGES_WITH_VIDEO} images + {MAX_VIDEOS} video.</Text>


            {renderFieldError('productName')}
            <PaperInput
                label="Product Name"
                value={productName}
                mode="outlined"
                onChangeText={handleInputChange(setProductName, 'productName')}
                outlineColor="grey"
                activeOutlineColor="#FF0000"
                error={!!formErrors.productName}
                disabled={buttonLoading}
                style={styles.inputField}
            />

            {renderFieldError('description')}
            <PaperInput
                label="Description"
                mode="outlined"
                value={description}
                onChangeText={handleInputChange(setDescription, 'description')}
                outlineColor="grey"
                activeOutlineColor="#FF0000"
                multiline={true}
                numberOfLines={6}
                error={!!formErrors.description}
                disabled={buttonLoading}
                style={styles.inputField}
            />

            {renderFieldError('originalPrice')}
            <PaperInput
                 label="Original Price (PKR)"
                mode="outlined"
                value={originalPrice}
                onChangeText={handleInputChange(setOriginalPrice, 'originalPrice')}
                keyboardType="numeric"
                outlineColor="grey"
                activeOutlineColor="#FF0000"
                error={!!formErrors.originalPrice}
                disabled={buttonLoading}
                style={styles.inputField}
            />

             {renderFieldError('discountedPrice')}
            <PaperInput
                label="Discounted Price (PKR) (Optional)"
                mode="outlined"
                value={discountedPrice}
                onChangeText={handleInputChange(setDiscountedPrice, 'discountedPrice')}
                keyboardType="numeric"
                outlineColor="grey"
                activeOutlineColor="#FF0000"
                error={!!formErrors.discountedPrice}
                disabled={buttonLoading}
                style={styles.inputField}
            />

            <Text style={styles.label}>Category</Text>
              {loadingCategories && visible && <ActivityIndicator size="small" color="#FF0000" style={{marginLeft: 10, alignSelf: 'flex-start', marginBottom: -10, marginTop: -5}} />}
              {renderFieldError('category')}
             <View style={[ styles.pickerContainer, !!formErrors.category && styles.pickerErrorBorder ]}>
                 <Picker
                     selectedValue={category}
                     style={styles.picker}
                     onValueChange={(itemValue) => {
                         setCategory(itemValue);
                         if (submitAttempted) {
                             setFormErrors(prev => ({ ...prev, category: itemValue ? null : 'Category is required.' }));
                         }
                     }}
                     enabled={!loadingCategories && !buttonLoading}
                     dropdownIconColor="#555"
                     mode="dropdown"
                     prompt="Select a Category"
                 >
                     <Picker.Item label="-- Select Category --" value="" style={styles.pickerPlaceholder} />
                     {fetchedCategories.map((cat) => (
                         <Picker.Item key={cat.id} label={cat.categoryName || `Unnamed (${cat.id.substring(0,4)})`} value={cat.id} />
                     ))}
                 </Picker>
             </View>

            <Text style={styles.label}>Payment Options</Text>
             {renderFieldError('paymentOption')}
            <View style={styles.paymentOptions}>
                <TouchableOpacity
                    onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.COD)}
                    style={[ styles.paymentOptionButton, paymentOption.COD && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity, !!formErrors.paymentOption && styles.paymentOptionErrorBorder ]}
                    disabled={buttonLoading}
                >
                    <Icon name={paymentOption.COD ? "check-circle" : "circle-outline"} size={20} color={paymentOption.COD ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                    <Text style={[styles.paymentOptionText, paymentOption.COD && styles.selectedPaymentOptionText]}> COD </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL)}
                    style={[ styles.paymentOptionButton, paymentOption.BNPL && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity, !!formErrors.paymentOption && styles.paymentOptionErrorBorder ]}
                    disabled={buttonLoading}
                >
                   <Icon name={paymentOption.BNPL ? "check-circle" : "circle-outline"} size={20} color={paymentOption.BNPL ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                    <Text style={[styles.paymentOptionText, paymentOption.BNPL && styles.selectedPaymentOptionText]}> BNPL </Text>
                </TouchableOpacity>
            </View>

             {paymentOption.BNPL && (
                  <>
                  {loadingBNPL && (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF0000" />
                        <Text style={styles.loadingText}>Loading BNPL Plans...</Text>
                     </View>
                  )}
                  {!loadingBNPL && fetchedBNPLPlans.length > 0 && (
                      <>
                           <Text style={styles.label}>Available BNPL Plan(s)</Text>
                           {renderFieldError('bnplPlans')}
                           <View style={[styles.bnplListContainer, !!formErrors.bnplPlans && styles.bnplContainerErrorBorder]}>
                               <TouchableOpacity
                                    onPress={toggleSelectAllPlans}
                                    style={[styles.planItem, styles.selectAllContainer, (buttonLoading || fetchedBNPLPlans.length === 0) && styles.disabledOpacity]}
                                    disabled={buttonLoading || fetchedBNPLPlans.length === 0} >
                                    <View style={styles.checkbox}>
                                       <Icon name={selectAll ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectAll ? '#FF0000' : '#555'} />
                                   </View>
                                   <Text style={styles.selectAllPlansText}> {selectAll ? 'Deselect All Plans' : 'Select All Plans'} </Text>
                               </TouchableOpacity>

                              {fetchedBNPLPlans.map((plan) => (
                                  <TouchableOpacity
                                      key={plan.id}
                                      style={[ styles.planItem, selectedPlans.includes(plan.id) && styles.selectedPlan, buttonLoading && styles.disabledOpacity ]}
                                      onPress={() => togglePlanSelection(plan.id)}
                                      disabled={buttonLoading}
                                  >
                                        <View style={styles.checkbox}>
                                           <Icon name={selectedPlans.includes(plan.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedPlans.includes(plan.id) ? '#FF0000' : '#555'} />
                                       </View>
                                       <View style={styles.planDetails}>
                                           <Text style={styles.planText} numberOfLines={1}>{plan.planName || `Plan ${plan.id.substring(0,4)}`}</Text>
                                           {plan.planType && <Text style={styles.planType}>({plan.planType})</Text>}
                                           {plan.durationMonths && <Text style={styles.planDuration}>{plan.durationMonths} mo</Text>}
                                       </View>
                                  </TouchableOpacity>
                              ))}
                           </View>
                      </>
                  )}
                  {!loadingBNPL && fetchedBNPLPlans.length === 0 && paymentOption.BNPL && ( // Only show if BNPL is on
                      <Text style={styles.noPlansText}> No BNPL plans available or failed to load. </Text>
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
                        <Text style={styles.buttonText}>{product ? 'Update Product' : 'Upload Product'}</Text>
                    )}
                </TouchableOpacity>
            </View>

              {imagePreview && (
                  <Modal
                      visible={!!imagePreview} // Control visibility directly
                      transparent={true}
                      animationType="fade"
                      onRequestClose={closePreview}
                  >
                       <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}>
                            <Icon name="close-circle" size={40} color="white" />
                        </TouchableOpacity>
                        <Image
                            source={{ uri: imagePreview }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                      </View>
                  </Modal>
              )}
              {videoPreview && (
                  <Modal
                      visible={!!videoPreview} // Control visibility directly
                      transparent={true}
                      animationType="fade"
                      onRequestClose={closePreview}
                  >
                     <View style={styles.modalContainer}>
                        <TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}>
                            <Icon name="close-circle" size={40} color="white" />
                        </TouchableOpacity>
                        <Video
                              source={{ uri: videoPreview }}
                              style={styles.previewVideo}
                              useNativeControls
                              resizeMode="contain"
                              shouldPlay={false}
                              onError={(err) => {
                                  console.error("Video Preview Error:", err);
                                  Alert.alert("Video Error", "Could not load the video for preview.");
                                  closePreview();
                              }}
                          />
                      </View>
                  </Modal>
              )}
        </ScrollView>
    );
};

UploadProductComponent.propTypes = {
    visible: PropTypes.bool.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    product: PropTypes.shape({
      id: PropTypes.string, // ID is not required for adding
      name: PropTypes.string,
      category: PropTypes.string,
      description: PropTypes.string,
      originalPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      discountedPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.oneOf([null])]), // Allow null
      media: PropTypes.shape({
        images: PropTypes.arrayOf(PropTypes.string),
        video: PropTypes.oneOfType([PropTypes.string, PropTypes.oneOf([null])]), // Allow null
      }),
      paymentOption: PropTypes.shape({
          COD: PropTypes.bool,
          BNPL: PropTypes.bool
      }),
      BNPLPlans: PropTypes.arrayOf(PropTypes.string),
    }),
};

// --- Styles (Keep styles exactly as they were) ---
const styles = StyleSheet.create({
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
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    loadingText: {
        marginTop: 5,
        color: '#555',
    },
    closeButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 45 : 15,
        right: 15,
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
        marginBottom: 15,
        padding: 10,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#B00020',
    },
    inputField: {
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    errorTextAbove: {
        paddingBottom: 0,
        marginBottom: 2,
        paddingLeft: 2,
        fontSize: 12,
        color: '#B00020',
    },
    pickerContainer: {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'grey',
        backgroundColor: '#fff',
        marginBottom: 12,
        overflow: 'hidden',
        minHeight: 50,
        justifyContent: 'center',
    },
    picker: {
        color: '#000'
    },
    pickerPlaceholder: {
       color: '#999',
    },
    pickerErrorBorder: {
      borderColor: '#B00020',
      borderWidth: 1.5,
    },
    mediaButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
        marginTop: 5,
    },
    selectMediaButton: {
        backgroundColor: '#FF0000',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        flex: 1,
        marginHorizontal: 5,
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
    buttonIcon: {
        marginRight: 8,
    },
    mediaHint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginBottom: 15,
        marginTop: 4,
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
        overflow: 'hidden',
        backgroundColor: '#eee',
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    mediaVideoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 2,
    },
    uploadIndicatorText: {
        color: '#fff',
        fontSize: 10,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    removeMediaButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 15,
        padding: 3,
        zIndex: 1,
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
        backgroundColor: '#f0f1f1',
        flex: 1,
        marginHorizontal: 5,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        minHeight: 50,
    },
    paymentOptionErrorBorder: {
      borderColor: '#B00020',
      borderWidth: 1.5,
    },
    paymentOptionText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#444',
    },
    selectedPaymentOption: {
        borderColor: '#FF0000',
        backgroundColor: '#fff',
        borderWidth: 1.5,
    },
    selectedPaymentOptionText: {
        color: '#FF0000',
    },
    bnplListContainer: {
        marginBottom: 15,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        overflow: 'hidden',
        backgroundColor: '#fdfdfd',
    },
    bnplContainerErrorBorder: {
       borderColor: '#B00020',
       borderWidth: 1.5,
    },
    selectAllContainer: {
       borderBottomWidth: 1,
       borderBottomColor: '#ccc',
       backgroundColor: '#f0f0f0',
    },
    planItem: {
       flexDirection: 'row',
       alignItems: 'center',
       paddingVertical: 10,
       paddingHorizontal: 10,
       borderBottomWidth: 1,
       borderBottomColor: '#eee',
       backgroundColor: '#fff',
    },
    selectedPlan: {
       backgroundColor: '#ffebee',
       borderColor: '#ffcdd2',
       borderWidth: 1,
       marginHorizontal: -1,
       borderBottomColor: '#ffcdd2',
    },
    checkbox: {
       width: 24,
       height: 24,
       marginRight: 12,
       justifyContent: 'center',
       alignItems: 'center',
    },
    planDetails: {
       flex: 1,
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       flexWrap: 'wrap',
    },
    planText: {
       fontSize: 15,
       fontWeight: '500',
       color: '#333',
       flexShrink: 1,
       marginRight: 5,
    },
    planType: {
       fontSize: 13,
       fontWeight: '400',
       color: '#666',
       fontStyle: 'italic',
       marginHorizontal: 5,
    },
    planDuration: {
       fontSize: 13,
       fontWeight: '500',
       color: '#444',
       marginLeft: 'auto',
       paddingLeft: 8,
    },
    selectAllPlansText: {
       fontSize: 15,
       fontWeight: '600',
       color: '#FF0000',
    },
    noPlansText: {
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
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 15,
        paddingBottom: 10,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        minHeight: 50,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
    cancelButton: {
        backgroundColor: '#6c757d',
        marginRight: 10,
    },
    saveButton: {
        backgroundColor: '#FF0000',
        marginLeft: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    disabledButton: {
       backgroundColor: '#ff6666',
       opacity: 0.7,
       elevation: 0,
       shadowOpacity: 0,
    },
    disabledOpacity: {
       opacity: 0.5,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    modalCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        right: 15,
        zIndex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: 8,
        borderRadius: 25,
    },
    previewImage: {
        width: '95%',
        height: '80%',
    },
    previewVideo: {
        width: '95%',
        height: '80%',
         backgroundColor: '#000',
    },
});

export default UploadProductComponent;