// ****** EditProductComponent.js (Fetches Own Data via productId - Final Version with Specific Flow) ******

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator as RNActivityIndicator,
    Alert, Modal as RNModal, Image, Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Video } from 'expo-av';
import { TextInput as PaperInput, HelperText, ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import PropTypes from 'prop-types';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; // Firestore imports
import { db } from './../firebaseConfig'; // <<<--- CHECK/ADJUST PATH

import {
    uploadImage as uploadImageToCloudinary,
    uploadVideo as uploadVideoToCloudinary
} from './../Components/UploadImage'; // <<<--- CHECK/ADJUST PATH

// Constants
const MEDIA_TYPES = { IMAGE: 'image', VIDEO: 'video' };
const PAYMENT_OPTIONS = { COD: 'COD', BNPL: 'BNPL' };
const MAX_IMAGES = 3; const MAX_IMAGES_WITH_VIDEO = 2; const MAX_VIDEOS = 1;

const EditProductComponent = ({ visible, onDismiss, onSave, productId }) => {
    console.log(`EditProductComponent: Rendering. Received productId: ${productId}`);

    // --- State Variables ---
    const [isFetchingDetails, setIsFetchingDetails] = useState(false); // Tracks fetch for THIS component
    const [fetchError, setFetchError] = useState(null); // Stores fetch errors for THIS component

    // Form state - Initialized empty, set AFTER data is fetched
    const [productName, setProductName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [originalPrice, setOriginalPrice] = useState('');
    const [discountedPrice, setDiscountedPrice] = useState('');
    const [media, setMedia] = useState({ images: [], video: null }); // Holds { uri: string, isUploaded: boolean }
    const [paymentOption, setPaymentOption] = useState({ COD: true, BNPL: false });
    const [selectedPlans, setSelectedPlans] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    // State for related data (fetched independently)
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [fetchedCategories, setFetchedCategories] = useState([]);
    const [loadingBNPL, setLoadingBNPL] = useState(false);
    const [fetchedBNPLPlans, setFetchedBNPLPlans] = useState([]);

    // UI/Submission state
    const [buttonLoading, setButtonLoading] = useState(false); // For Update button spinner during submit
    const [imagePreview, setImagePreview] = useState(null);
    const [videoPreview, setVideoPreview] = useState(null);
    const [formErrors, setFormErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);

    // Refs to track previous prop values
    const prevVisible = useRef(visible);
    const prevProductId = useRef(productId);

    // --- Fetch Categories Effect (Still needed for the Picker) ---
    useEffect(() => {
        let isMounted = true;
        const fetchCategories = async () => {
            if (!visible || (fetchedCategories.length > 0 && !loadingCategories)) { if(isMounted) setLoadingCategories(false); return; }
            console.log("EditProductComponent: Fetching categories list...");
            if(isMounted) setLoadingCategories(true);
            try {
                const querySnapshot = await getDocs(collection(db, 'Category'));
                const categoriesData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                if (isMounted) { setFetchedCategories(categoriesData); console.log("EditProductComponent: Categories fetched:", categoriesData.length); }
            } catch (error) { console.error("EditProductComponent: Error fetching categories: ", error); if (isMounted) setFetchError("Failed to load categories."); } // Set general error
            finally { if (isMounted) setLoadingCategories(false); }
        };
        if (visible) { fetchCategories(); }
        return () => { isMounted = false; };
    }, [visible]);


     // --- Handle Payment Option Toggle ---
     const handlePaymentOptionChange = useCallback(async (option, isInitialLoadFromFetch = false) => {
        console.log(`EditProductComponent: Payment option change for: ${option}. Initial load: ${isInitialLoadFromFetch}`);
        let isMounted = true;
        const currentOptions = { ...paymentOption };
        const wantsToSelect = !currentOptions[option];
        const newPaymentOptions = { ...paymentOption, [option]: wantsToSelect };
        setPaymentOption(newPaymentOptions);

        if (submitAttempted) { const atleastOneSelected = newPaymentOptions.COD || newPaymentOptions.BNPL; setFormErrors(prev => ({ ...prev, paymentOption: atleastOneSelected ? null : 'Select option.' })); }

        if (option === PAYMENT_OPTIONS.BNPL && wantsToSelect) {
            const needsFetching = fetchedBNPLPlans.length === 0;
            if (needsFetching) {
                console.log("EditProductComponent: Fetching BNPL plans via toggle...");
                setLoadingBNPL(true);
                if (!isInitialLoadFromFetch) { setSelectedPlans([]); setSelectAll(false); }
                try {
                    const querySnapshot = await getDocs(collection(db, 'BNPL_plans'));
                    const plansData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    if (isMounted) { setFetchedBNPLPlans(plansData); console.log("EditProductComponent: BNPL Plans fetched:", plansData.length); }
                    if (!isInitialLoadFromFetch && isMounted) {
                         setSelectedPlans([]);
                         if (submitAttempted) { setFormErrors(prev => ({ ...prev, bnplPlans: 'Select BNPL plan(s).' })); }
                    }
                } catch (error) {
                    console.error("EditProductComponent: Error fetching BNPL plans: ", error);
                    if (isMounted) { setFetchError("Failed to load payment plans."); setPaymentOption(prev => ({ ...prev, BNPL: false })); setFetchedBNPLPlans([]); setSelectedPlans([]); setSelectAll(false); if (submitAttempted) { setFormErrors(prev => ({ ...prev, paymentOption: prev.COD ? null : 'Select option.', bnplPlans: null })); } }
                } finally { if (isMounted) setLoadingBNPL(false); }
            } else if (!needsFetching && !isInitialLoadFromFetch) {
                 setSelectedPlans([]); setSelectAll(false); if (submitAttempted) { setFormErrors(prev => ({ ...prev, bnplPlans: 'Select BNPL plan(s).' })); }
            }
        } else if (option === PAYMENT_OPTIONS.BNPL && !wantsToSelect) {
             setSelectedPlans([]); setSelectAll(false); setLoadingBNPL(false); if (submitAttempted) { setFormErrors(prev => ({ ...prev, bnplPlans: null })); }
        }
        return () => { isMounted = false; };
    }, [paymentOption, submitAttempted, fetchedBNPLPlans.length, selectedPlans]);


    // --- Fetch Product Details & Initialize Form State Effect ---
    useEffect(() => {
        let isMounted = true;

        const fetchProductDetails = async () => {
            if (!productId) {
                console.log("EditProductComponent: No productId provided, cannot fetch.");
                if (isMounted) {
                    // Don't reset form state on missing ID if modal just opened potentially without one
                    setFetchError("No product selected for editing."); // Show error instead
                    setIsFetchingDetails(false);
                }
                return;
            }

            console.log(`EditProductComponent: useEffect fetching details for productId: ${productId}`);
            if(isMounted) {
                setIsFetchingDetails(true); // <-- Show Loader
                setFetchError(null);
                setFormErrors({});
                setSubmitAttempted(false);
                 // Clear previous form data when starting fetch for a new ID
                 // This prevents showing old data briefly if switching between edits quickly
                 setProductName(''); setCategory(''); setDescription(''); setOriginalPrice(''); setDiscountedPrice(''); setMedia({ images: [], video: null }); setPaymentOption({ COD: true, BNPL: false }); setSelectedPlans([]); setSelectAll(false);
            }

            try {
                const productRef = doc(db, 'Products', productId);
                const docSnap = await getDoc(productRef);

                if (!isMounted) return; // Check after async

                if (docSnap.exists()) {
                    const productData = docSnap.data();
                    console.log("EditProductComponent: Product data fetched successfully.");

                    // --- Log fetched data before setting state ---
                    console.log("--- Fetched Product Details Log ---");
                    console.log("  Name:", productData.name || '(Not Set)');
                    console.log("  Category ID:", productData.category || '(Not Set)');
                    console.log("  Description:", productData.description?.substring(0, 50) + '...' || '(Not Set)'); // Log snippet
                    console.log("  Original Price:", productData.originalPrice ?? '(Not Set)');
                    console.log("  Discounted Price:", productData.discountedPrice ?? '(Not Set)');
                    console.log("  Media Images:", JSON.stringify(productData.media?.images) || '(Not Set)');
                    console.log("  Media Video:", productData.media?.video || '(Not Set)');
                    console.log("  Payment Option:", JSON.stringify(productData.paymentOption) || '(Not Set)');
                    console.log("  BNPL Plans:", JSON.stringify(productData.BNPLPlans) || '(Not Set)');
                    console.log("------------------------------------");
                    // --- End Logging ---

                    // --- Initialize State from Fetched Data (only if still mounted) ---
                    if (isMounted) {
                        setProductName(productData.name || '');
                        const categoryId = productData.category || '';
                        if (fetchedCategories.length > 0) { const categoryExists = fetchedCategories.some(cat => cat.id === categoryId); setCategory(categoryExists ? categoryId : ''); if (!categoryExists) console.warn(`Cat ID ${categoryId} missing.`); }
                        else { setCategory(categoryId); }
                        setDescription(productData.description || '');
                        setOriginalPrice(productData.originalPrice?.toString() || '');
                        setDiscountedPrice(productData.discountedPrice != null ? productData.discountedPrice.toString() : '');
                        const initialImages = (Array.isArray(productData.media?.images) ? productData.media.images : []).filter(Boolean).map(url => ({ uri: url, isUploaded: true }));
                        const initialVideo = productData.media?.video ? { uri: productData.media.video, isUploaded: true } : null;
                        setMedia({ images: initialImages, video: initialVideo });
                        const initialPaymentOption = { COD: productData.paymentOption?.COD ?? true, BNPL: productData.paymentOption?.BNPL ?? false };
                        setPaymentOption(initialPaymentOption);

                        // Set BNPL Plans (check if plans list is ready)
                        const productPlans = Array.isArray(productData.BNPLPlans) ? productData.BNPLPlans : [];
                        if (initialPaymentOption.BNPL) {
                            if (fetchedBNPLPlans.length > 0) {
                                const validSelectedPlans = productPlans.filter(id => fetchedBNPLPlans.some(p => p.id === id));
                                setSelectedPlans(validSelectedPlans);
                                setSelectAll(fetchedBNPLPlans.length > 0 && validSelectedPlans.length === fetchedBNPLPlans.length);
                            } else {
                                // Trigger fetch if plans aren't ready, but store the desired IDs temporarily?
                                // Or just trigger fetch and let handlePaymentOptionChange logic handle setting later?
                                // Let's trigger fetch. The selection will be empty until plans load.
                                 setSelectedPlans([]); // Clear selection for now
                                 setSelectAll(false);
                                 handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL, true); // Trigger fetch
                            }
                        } else {
                            setSelectedPlans([]); setSelectAll(false);
                        }
                        console.log("EditProductComponent: State initialized from fetched data.");
                    }
                    // --- End State Initialization ---

                } else { // Document not found
                    console.error(`EditProductComponent: Product document ${productId} not found.`);
                    if(isMounted) setFetchError(`Product not found.`);
                    // No resetFormState here - keep fields empty, show error UI
                }
            } catch (error) { // Fetch error
                console.error(`EditProductComponent: Error fetching product ${productId}: `, error);
                if(isMounted) setFetchError(`Failed to load details: ${error.message}`);
                // No resetFormState here - keep fields empty, show error UI
            } finally {
                if(isMounted) setIsFetchingDetails(false); // <-- Hide Loader
            }
        };

        // --- Trigger Logic ---
        // Only fetch if visible AND productId is present AND (it's the first time OR the ID changed)
        if (visible && productId && (productId !== prevProductId.current || !prevVisible.current)) {
             fetchProductDetails();
        } else if (!visible && prevVisible.current) {
            // Optional: Reset form state when modal becomes hidden *if desired*
             // resetFormState();
             console.log("EditProductComponent: Modal closed.");
        } else if (visible && !productId) {
             // If modal becomes visible without a productId (e.g., parent state issue)
             setFetchError("No product selected.");
             setIsFetchingDetails(false);
        }

        // Update refs for next render
        prevVisible.current = visible;
        prevProductId.current = productId;

        // Cleanup
        return () => { isMounted = false; };

    }, [visible, productId, fetchedCategories.length, fetchedBNPLPlans.length, handlePaymentOptionChange]); // Removed resetFormState


    // --- Form Validation ---
    const validateForm = useCallback((showErrors = false) => { /* ... */}, [/* deps */]);
    // --- Handle Input Changes ---
    const handleInputChange = useCallback((setter, fieldName) => (value) => { /* ... */ }, [submitAttempted]);
    // --- BNPL Logic ---
    const togglePlanSelection = useCallback((planId) => { /* ... */ }, [/* deps */]);
    const toggleSelectAllPlans = useCallback(() => { /* ... */ }, [/* deps */]);
    // --- Media Handling Logic ---
    const checkMediaLimits = useCallback((type, count = 1) => { /* ... */ }, [media]);
    const requestPermissions = useCallback(async (permissionType) => { /* ... */ }, []);
    const pickMediaFromLibrary = useCallback(async (type) => { /* ... */ }, [/* deps */]);
    const captureMediaWithCamera = useCallback(async (type) => { /* ... */ }, [/* deps */]);
    const showMediaSourceOptions = useCallback((type) => { /* ... */ }, [/* deps */]);
    const removeMedia = useCallback((index, type) => { /* ... */ }, [submitAttempted]);
    const handleImagePreview = useCallback((uri) => { /* ... */ }, []);
    const handleVideoPreview = useCallback((uri) => { /* ... */ }, []);
    const closePreview = useCallback(() => { /* ... */ }, []);

    // --- Handle Form Submission ---
    const handleSubmit = useCallback(async () => {
        if (!productId) { Alert.alert('Error', 'Product ID missing.'); return; }
        setSubmitAttempted(true);
        if (!validateForm(true)) { Alert.alert('Validation Error', 'Please fix errors.'); return; }
        setButtonLoading(true); // <-- Show loader ON SUBMIT
        setFormErrors({});

        try {
            console.log(`EditProductComponent: Starting UPDATE for ID: ${productId}...`);
            // --- Media upload logic (await is crucial) ---
            const newImagesToUpload = media.images.filter(img => !img.isUploaded);
            const existingImageUrls = media.images.filter(img => img.isUploaded).map(img => img.uri);
            const newVideoToUpload = media.video && !media.video.isUploaded ? media.video : null;
            const existingVideoUrl = media.video && media.video.isUploaded ? media.video.uri : null;
            let uploadedImageUrls = []; let uploadedVideoUrl = null;

            if (newImagesToUpload.length > 0) {
                 console.log(`Uploading ${newImagesToUpload.length} new image(s)...`);
                 const uploadPromises = newImagesToUpload.map(img => uploadImageToCloudinary({ uri: img.uri }));
                 const results = await Promise.allSettled(uploadPromises); // Wait for all uploads
                 results.forEach((result, index) => { if (result.status === 'fulfilled' && result.value?.cloudinaryUrl) { uploadedImageUrls.push(result.value.cloudinaryUrl); } else { throw new Error(`Image upload failed: ${result.reason?.message || `(Index ${index})`}`); } });
            }
            if (newVideoToUpload) {
                 console.log("Uploading new video...");
                 const result = await uploadVideoToCloudinary({ uri: newVideoToUpload.uri }); // Wait for video upload
                 if (result?.cloudinaryUrl) { uploadedVideoUrl = result.cloudinaryUrl; } else { throw new Error("Video upload failed."); }
            }
            // --- End Media upload ---

            const finalImageUrls = [...existingImageUrls, ...uploadedImageUrls];
            const finalVideoUrl = uploadedVideoUrl || existingVideoUrl;
            if (finalImageUrls.length === 0) { throw new Error("At least one image is required."); }

            // Prepare data payload from component's current state
            const origPrice = Number(originalPrice); const discPrice = discountedPrice.trim() ? Number(discountedPrice) : null; const finalDiscountedPrice = (discPrice !== null && !isNaN(discPrice) && discPrice >= 0 && discPrice < origPrice) ? discPrice : null; const finalPrice = finalDiscountedPrice !== null ? finalDiscountedPrice : origPrice;
            const productDataForSave = { name: productName.trim(), category, description: description.trim(), originalPrice: origPrice, discountedPrice: finalDiscountedPrice, price: finalPrice, media: { images: finalImageUrls, video: finalVideoUrl }, paymentOption, BNPLPlans: paymentOption.BNPL ? selectedPlans : [] };

            console.log("EditProductComponent: Calling onSave prop with data:", productDataForSave);
            const saveSuccessful = await onSave(productDataForSave); // Await parent function

            if (saveSuccessful) {
                 // Success: Show alert, dismiss AFTER user clicks OK
                 Alert.alert("Success", "Product updated successfully!", [{ text: "OK", onPress: onDismiss }]);
            } else {
                 console.log("EditProductComponent: Parent onSave function indicated failure.");
                 // Keep modal open, potentially show error via setFormErrors({ submit: ... })
            }

        } catch (error) { // Catches errors from validation, uploads, or parent's onSave
            console.error("EditProductComponent: Update handleSubmit failed:", error);
            const displayMessage = `Update failed: ${error.message || 'Unknown error'}`;
            setFormErrors({ submit: displayMessage }); Alert.alert('Update Error', displayMessage);
        } finally {
            setButtonLoading(false); // <-- Hide loader AFTER process finishes
        }
    }, [ // Dependencies
        productId, productName, category, description, originalPrice, discountedPrice,
        media, paymentOption, selectedPlans,
        validateForm, onSave, onDismiss
    ]);

    // --- Render Function ---
    const renderFieldError = (fieldName) => (formErrors[fieldName] ? <HelperText type="error" visible={true} style={styles.errorTextAbove}>{formErrors[fieldName]}</HelperText> : null );

    // --- Loading / Error UI ---
    if (isFetchingDetails) {
        return ( <View style={styles.loaderContainerCentered}><PaperActivityIndicator size="large" color="#FF0000" /><Text style={styles.loadingText}>Loading Details...</Text><TouchableOpacity style={styles.closeButtonOnError} onPress={onDismiss}><Icon name="close" size={24} color="#888" /></TouchableOpacity></View> );
    }
    if (fetchError) {
        return ( <View style={styles.loaderContainerCentered}><TouchableOpacity style={styles.closeButtonOnError} onPress={onDismiss}><Icon name="close" size={24} color="#888" /></TouchableOpacity><Icon name="alert-circle-outline" size={40} color="#B00020" /><Text style={styles.errorTextLarge}>Error Loading</Text><Text style={styles.errorTextSmall}>{fetchError}</Text></View> );
    }

    // --- Form UI ---
    const imageLimit = media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES;
    // ... other render calculations ...

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" >
            <TouchableOpacity style={styles.closeButton} onPress={onDismiss} disabled={buttonLoading}>
                <Icon name="close-circle" size={30} color="white" />
            </TouchableOpacity>
            {renderFieldError('submit')}

            {/* --- Form Content --- */}
            {/* Media Section */}
            <Text style={styles.label}>Product Media</Text>
             {renderFieldError('media')}
             <View style={styles.mediaPreviewContainer}>
                 {media.images.map((img, index) => ( <TouchableOpacity key={`${img.uri}-${index}`} onPress={() => handleImagePreview(img.uri)} disabled={buttonLoading} style={styles.mediaPreviewWrapper}><View style={styles.mediaPreview}><Image source={{ uri: img.uri }} style={styles.mediaImage} onError={(e) => console.warn(`Edit Img load err ${index}`)} />{!img.isUploaded && <View style={styles.uploadIndicator}><Text style={styles.uploadIndicatorText}>New</Text></View>}<TouchableOpacity onPress={() => removeMedia(index, MEDIA_TYPES.IMAGE)} style={styles.removeMediaButton} disabled={buttonLoading}><Icon name="close-circle" size={22} color="#fff" /></TouchableOpacity></View></TouchableOpacity> ))}
                 {media.video && ( <TouchableOpacity key={media.video?.uri || 'video'} onPress={() => handleVideoPreview(media.video.uri)} disabled={buttonLoading} style={styles.mediaPreviewWrapper}><View style={styles.mediaPreview}><View style={styles.mediaVideoPlaceholder}><Icon name="play-circle-outline" size={40} color="#FFF" /></View>{!media.video.isUploaded && <View style={styles.uploadIndicator}><Text style={styles.uploadIndicatorText}>New</Text></View>}<TouchableOpacity onPress={() => removeMedia(null, MEDIA_TYPES.VIDEO)} style={styles.removeMediaButton} disabled={buttonLoading}><Icon name="close-circle" size={22} color="#fff" /></TouchableOpacity></View></TouchableOpacity> )}
             </View>
             <View style={styles.mediaButtonContainer}>
                 <TouchableOpacity onPress={() => showMediaSourceOptions(MEDIA_TYPES.IMAGE)} style={[styles.selectMediaButton, (media.images.length >= (media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES) || buttonLoading) && styles.disabledOpacity]} disabled={media.images.length >= (media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES) || buttonLoading}><Icon name="image-plus" size={20} color="#fff" style={styles.buttonIcon} /><Text style={styles.selectMediaText}>Add Image ({media.images.length}/{(media.video ? MAX_IMAGES_WITH_VIDEO : MAX_IMAGES)})</Text></TouchableOpacity>
                 <TouchableOpacity onPress={() => showMediaSourceOptions(MEDIA_TYPES.VIDEO)} style={[styles.selectMediaButton, (!!media.video || buttonLoading || media.images.length > MAX_IMAGES_WITH_VIDEO) && styles.disabledOpacity]} disabled={!!media.video || buttonLoading || media.images.length > MAX_IMAGES_WITH_VIDEO}><Icon name="video-plus" size={20} color="#fff" style={styles.buttonIcon} /><Text style={styles.selectMediaText}>{!!media.video ? 'Video Added' : 'Add Video'}</Text></TouchableOpacity>
             </View>
             {media.images.length > MAX_IMAGES_WITH_VIDEO && !media.video && <Text style={styles.warningText}>Remove images to add video.</Text>}
             <Text style={styles.mediaHint}>Max {MAX_IMAGES} images OR {MAX_IMAGES_WITH_VIDEO} images + {MAX_VIDEOS} video.</Text>

             {/* Form Fields */}
             {renderFieldError('productName')}
             <PaperInput label="Product Name" value={productName} mode="outlined" onChangeText={handleInputChange(setProductName, 'productName')} style={styles.inputField} error={!!formErrors.productName} disabled={buttonLoading} />
             {renderFieldError('description')}
             <PaperInput label="Description" value={description} multiline numberOfLines={6} mode="outlined" onChangeText={handleInputChange(setDescription, 'description')} style={[styles.inputField, { height: 120 }]} error={!!formErrors.description} disabled={buttonLoading}/>
             {renderFieldError('originalPrice')}
             <PaperInput label="Original Price (PKR)" value={originalPrice} keyboardType="numeric" mode="outlined" onChangeText={handleInputChange(setOriginalPrice, 'originalPrice')} style={styles.inputField} error={!!formErrors.originalPrice} disabled={buttonLoading}/>
             {renderFieldError('discountedPrice')}
             <PaperInput label="Discounted Price (PKR) (Optional)" value={discountedPrice} keyboardType="numeric" mode="outlined" onChangeText={handleInputChange(setDiscountedPrice, 'discountedPrice')} style={styles.inputField} error={!!formErrors.discountedPrice} disabled={buttonLoading}/>

             {/* Category Picker */}
             <Text style={styles.label}>Category</Text>
             {loadingCategories && <PaperActivityIndicator size="small" color="#FF0000" style={styles.inlineLoader} />}
             {renderFieldError('category')}
             <View style={[ styles.pickerContainer, !!formErrors.category && styles.pickerErrorBorder ]}>
                 <Picker selectedValue={category} style={styles.picker} onValueChange={(v) => handleInputChange(setCategory, 'category')(v)} enabled={!loadingCategories && !buttonLoading && fetchedCategories.length > 0} mode="dropdown" prompt="Select Category">
                     <Picker.Item label="-- Select Category --" value="" style={styles.pickerPlaceholder} />
                     {fetchedCategories.map((cat) => ( <Picker.Item key={cat.id} label={cat.categoryName || 'Unnamed'} value={cat.id} /> ))}
                 </Picker>
             </View>
             {!loadingCategories && fetchedCategories.length === 0 && visible && <Text style={styles.warningText}>No categories loaded.</Text>}

             {/* Payment Options */}
             <Text style={styles.label}>Payment Options</Text>
             {renderFieldError('paymentOption')}
             <View style={styles.paymentOptions}>
                   <TouchableOpacity onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.COD)} style={[ styles.paymentOptionButton, paymentOption.COD && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity, !!formErrors.paymentOption && styles.paymentOptionErrorBorder ]} disabled={buttonLoading} >
                       <Icon name={paymentOption.COD ? "check-circle" : "circle-outline"} size={20} color={paymentOption.COD ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                       <Text style={[styles.paymentOptionText, paymentOption.COD && styles.selectedPaymentOptionText]}> COD </Text>
                   </TouchableOpacity>
                   <TouchableOpacity onPress={() => handlePaymentOptionChange(PAYMENT_OPTIONS.BNPL)} style={[ styles.paymentOptionButton, paymentOption.BNPL && styles.selectedPaymentOption, buttonLoading && styles.disabledOpacity, !!formErrors.paymentOption && styles.paymentOptionErrorBorder ]} disabled={buttonLoading} >
                       <Icon name={paymentOption.BNPL ? "check-circle" : "circle-outline"} size={20} color={paymentOption.BNPL ? "#FF0000" : "#888"} style={styles.buttonIcon}/>
                       <Text style={[styles.paymentOptionText, paymentOption.BNPL && styles.selectedPaymentOptionText]}> BNPL </Text>
                   </TouchableOpacity>
             </View>

             {/* BNPL Plans Section */}
             {paymentOption.BNPL && (
                 <>
                     {loadingBNPL && <View style={styles.loadingContainer}><PaperActivityIndicator size="large" color="#FF0000" /><Text style={styles.loadingText}>Loading Plans...</Text></View>}
                     {!loadingBNPL && fetchedBNPLPlans.length > 0 && (
                         <>
                             <Text style={styles.label}>Available BNPL Plan(s)</Text>
                             {renderFieldError('bnplPlans')}
                             <View style={[styles.bnplListContainer, !!formErrors.bnplPlans && styles.bnplContainerErrorBorder]}>
                                 <TouchableOpacity onPress={toggleSelectAllPlans} style={[styles.planItem, styles.selectAllContainer, buttonLoading && styles.disabledOpacity]} disabled={buttonLoading || fetchedBNPLPlans.length === 0} >
                                     <View style={styles.checkbox}><Icon name={selectAll ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectAll ? '#FF0000' : '#555'} /></View>
                                     <Text style={styles.selectAllPlansText}>{selectAll ? 'Deselect All' : 'Select All'}</Text>
                                 </TouchableOpacity>
                                 {fetchedBNPLPlans.map((plan) => (
                                     <TouchableOpacity key={plan.id} style={[styles.planItem, selectedPlans.includes(plan.id) && styles.selectedPlan, buttonLoading && styles.disabledOpacity]} onPress={() => togglePlanSelection(plan.id)} disabled={buttonLoading}>
                                         <View style={styles.checkbox}><Icon name={selectedPlans.includes(plan.id) ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color={selectedPlans.includes(plan.id) ? '#FF0000' : '#555'} /></View>
                                         <View style={styles.planDetails}>
                                             <Text style={styles.planText} numberOfLines={1}>{plan.planName || `Plan`}</Text>
                                             {plan.planType && <Text style={styles.planType}>({plan.planType})</Text>}
                                             {plan.durationMonths && <Text style={styles.planDuration}>{plan.durationMonths} mo</Text>}
                                         </View>
                                     </TouchableOpacity>
                                 ))}
                             </View>
                         </>
                     )}
                     {!loadingBNPL && fetchedBNPLPlans.length === 0 && <Text style={styles.noPlansText}>No BNPL plans available.</Text>}
                 </>
             )}

            {/* --- Action Buttons --- */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.button, styles.cancelButton, buttonLoading && styles.disabledOpacity]} onPress={onDismiss} disabled={buttonLoading}>
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.saveButton, buttonLoading && styles.disabledButton]} onPress={handleSubmit} disabled={buttonLoading || isFetchingDetails}>
                    {/* Show loader INSIDE the Update button */}
                    {buttonLoading ? (
                        <PaperActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Update Product</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* --- Media Preview Modals --- */}
            {imagePreview && ( <RNModal visible={!!imagePreview} transparent={true} animationType="fade" onRequestClose={closePreview}> <View style={styles.modalContainer}><TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Image source={{ uri: imagePreview }} style={styles.previewImage} resizeMode="contain" /></View></RNModal> )}
            {videoPreview && ( <RNModal visible={!!videoPreview} transparent={true} animationType="fade" onRequestClose={closePreview}> <View style={styles.modalContainer}><TouchableOpacity onPress={closePreview} style={styles.modalCloseButton}><Icon name="close-circle" size={40} color="white" /></TouchableOpacity><Video source={{ uri: videoPreview }} style={styles.previewVideo} useNativeControls resizeMode="contain" shouldPlay={true} onError={(err) => { console.error("Video Preview Error:", err); Alert.alert("Video Error", "Could not load preview."); closePreview(); }} /></View></RNModal> )}

        </ScrollView>
    );
};

// --- PropTypes ---
EditProductComponent.propTypes = {
    visible: PropTypes.bool.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    productId: PropTypes.string.isRequired, // Expect productId string
};

// --- Styles ---
const styles = StyleSheet.create({
    // --- Include ALL your styles here ---
    scrollContainer: { flexGrow: 1, padding: 15, backgroundColor: '#fff', paddingBottom: 50, paddingTop: Platform.OS === 'ios' ? 60 : 30, },
    loaderContainerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff', },
    loadingText: { marginTop: 15, fontSize: 16, color: '#555', },
    errorTextLarge: { fontSize: 18, fontWeight: 'bold', color: '#B00020', textAlign: 'center', marginBottom: 10, },
    errorTextSmall: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 25, },
    closeButtonOnError: { position: 'absolute', top: Platform.OS === 'ios' ? 45 : 15, right: 15, zIndex: 10, padding: 10 },
    inlineLoader: { alignSelf: 'flex-start', marginLeft: 10, marginBottom: -5 },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 45 : 15, right: 15, backgroundColor: 'rgba(255, 0, 0, 0.8)', padding: 5, borderRadius: 25, zIndex: 10, },
    label: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12, },
    submitErrorText: { marginBottom: 15, paddingVertical: 8, paddingHorizontal: 12, textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#B00020', backgroundColor: '#fdecea', borderWidth: 1, borderColor: '#B00020', borderRadius: 4, },
    inputField: { marginBottom: 10, backgroundColor: '#fff', },
    errorTextAbove: { paddingBottom: 0, marginBottom: 2, paddingLeft: 2, fontSize: 12, color: '#B00020', },
    warningText: { fontSize: 13, color: '#ffa000', textAlign: 'center', marginVertical: 5, paddingHorizontal: 10, },
    pickerContainer: { borderRadius: 4, borderWidth: 1, borderColor: 'grey', backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden', minHeight: 50, justifyContent: 'center', },
    picker: { color: '#000', height: 50, },
    pickerPlaceholder: { color: '#999', },
    pickerErrorBorder: { borderColor: '#B00020', borderWidth: 1.5, },
    mediaButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8, marginTop: 5, },
    selectMediaButton: { backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', flex: 1, marginHorizontal: 5, justifyContent: 'center', minHeight: 45, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, },
    selectMediaText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center', },
    buttonIcon: { marginRight: 8, },
    mediaHint: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 15, marginTop: 4, paddingHorizontal: 10, },
    mediaPreviewContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, marginTop: 5, },
    mediaPreviewWrapper: { marginRight: 10, marginBottom: 10, },
    mediaPreview: { position: 'relative', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee', width: 80, height: 80, justifyContent: 'center', alignItems: 'center', },
    mediaImage: { width: '100%', height: '100%', },
    mediaVideoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', },
    uploadIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', paddingVertical: 2, },
    uploadIndicatorText: { color: '#fff', fontSize: 10, textAlign: 'center', fontWeight: 'bold', },
    removeMediaButton: { position: 'absolute', top: -8, right: -8, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 15, padding: 3, zIndex: 1, },
    paymentOptions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, marginTop: 5, },
    paymentOptionButton: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f0f1f1', flex: 1, marginHorizontal: 5, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#ddd', minHeight: 50, },
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
    planType: { fontSize: 13, fontWeight: '400', color: '#666', fontStyle: 'italic', marginHorizontal: 5, },
    planDuration: { fontSize: 13, fontWeight: '500', color: '#444', marginLeft: 'auto', paddingLeft: 8, },
    selectAllPlansText: { fontSize: 15, fontWeight: '600', color: '#FF0000', },
    noPlansText: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 15, marginBottom: 15, fontStyle: 'italic', },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15, paddingBottom: 10, },
    button: { flex: 1, paddingVertical: 14, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', minHeight: 50, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 2, },
    cancelButton: { backgroundColor: '#6c757d', marginRight: 10, },
    saveButton: { backgroundColor: '#FF0000', marginLeft: 10, },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', },
    disabledButton: { backgroundColor: '#ff6666', opacity: 0.7, elevation: 0, shadowOpacity: 0, },
    disabledOpacity: { opacity: 0.5, },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)', },
    modalCloseButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 15, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 25, },
    previewImage: { width: '95%', height: '80%', },
    previewVideo: { width: '95%', height: '80%', backgroundColor: '#000', },
});

export default EditProductComponent;