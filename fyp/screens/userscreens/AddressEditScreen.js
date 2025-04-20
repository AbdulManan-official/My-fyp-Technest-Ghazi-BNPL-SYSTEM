// AddressEditScreen.js (No Top Space + Lighter Labels)
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
// import { SafeAreaView } from 'react-native-safe-area-context'; // <-- Removed SafeAreaView

// --- Firebase Imports ---
import { auth, db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

// --- Define Constants Locally ---
const THEME_RED = '#FF0000';
const ScreenBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#333';
// --- MODIFICATION: Lighter Label Color ---
const TextColorSecondary = '#888'; // Lighter grey (was #666)
// --- End Modification ---
const LightBorderColor = '#EEE';
const InputPlaceholderColor = '#BBB';
const ButtonTextColor = '#FFFFFF';

export default function AddressEditScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const initialData = route.params?.currentDetails ?? {};

    // --- State ---
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // --- Refs ---
    const phoneInputRef = useRef(null);
    const streetInputRef = useRef(null);
    const cityInputRef = useRef(null);
    const provinceInputRef = useRef(null);
    const postalInputRef = useRef(null);

    // --- Effect to Pre-fill Form Fields ---
    useEffect(() => {
        // ... (Prefill logic remains exactly the same) ...
        let initialStreet = '', initialCity = '', initialProvince = '', initialPostal = '';
        if (initialData.structuredAddress) { initialStreet = initialData.structuredAddress.street || ''; initialCity = initialData.structuredAddress.city || ''; initialProvince = initialData.structuredAddress.state || ''; initialPostal = initialData.structuredAddress.postalCode || ''; } else if ( initialData.addressString && typeof initialData.addressString === 'string' ) { const parts = initialData.addressString.split(','); initialStreet = parts[0]?.trim() || ''; initialCity = parts[1]?.trim() || ''; const provincePart = parts[2]?.trim() || ''; const postalMatch = provincePart.match(/\(([^)]+)\)/); if (postalMatch) { initialPostal = postalMatch[1]; initialProvince = provincePart.replace(/\s*\(([^)]+)\)/, '').trim(); } else { initialProvince = provincePart; } }
        setName(initialData.name || ''); setPhone(initialData.phone || ''); setStreetAddress(initialStreet); setCity(initialCity); setProvince(initialProvince); setPostalCode(initialPostal);
    }, [initialData]);

    // --- Handle Save Button Press ---
    const handleSaveChanges = async () => {
        // ... (Validation logic remains the same) ...
        const trimmedName = name.trim(); const trimmedPhone = phone.trim(); const trimmedStreet = streetAddress.trim(); const trimmedCity = city.trim(); const trimmedProvince = province.trim(); const trimmedPostalCode = postalCode.trim(); if (!trimmedName || !trimmedPhone || !trimmedStreet || !trimmedCity || !trimmedProvince) { Alert.alert( 'Missing Information', 'Please fill in Name, Phone, Street Address, City, and Province/State.' ); return; } if (trimmedPhone && !/^\d{11}$/.test(trimmedPhone)) { Alert.alert("Invalid Phone", "Please enter a valid 11-digit phone number."); return; } const user = auth.currentUser; if (!user || !user.uid) { Alert.alert('Authentication Error', 'You must be logged in.'); return; } const userId = user.uid; const deliveryAddressData = { street: trimmedStreet, city: trimmedCity, state: trimmedProvince, postalCode: trimmedPostalCode, };

        setIsLoading(true);

        try {
            // ... (Firestore save logic remains the same) ...
            const userDocRef = doc(db, 'Users', userId); await setDoc( userDocRef, { name: trimmedName, phone: trimmedPhone, deliveryAddress: deliveryAddressData, }, { merge: true } ); console.log('[AddressEditScreen] Firestore save successful.');
            // Show Alert on Success
            Alert.alert( 'Success', 'Your information has been updated successfully.' );
            // Stay on screen
        } catch (error) {
            // ... (Error handling remains the same) ...
            console.error('[AddressEditScreen] Firestore save error:', error); let errorMessage = 'Could not save details. Please try again.'; if (error.code === 'permission-denied') { errorMessage = 'Permission denied.'; } else if (error.message) { errorMessage = `Could not save details: ${error.message}`; } Alert.alert('Save Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Custom phone input handler
    const handlePhoneChange = (text) => {
        const v = text.replace(/[^0-9]/g, '');
        if (v.length <= 11) setPhone(v);
    };

    // --- Render Component UI ---
    // --- MODIFICATION: Removed SafeAreaView wrapper ---
    return (
        // <SafeAreaView style={styles.container}>
        <View style={styles.container}>
            {/* Keep StatusBar for consistency */}
            <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                // Adjust offset if needed, especially without SafeAreaView
                keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContentContainer} // Adjusted padding
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.detailsContainer}>
                        {/* Input Fields */}
                        {/* Name */}
                        <View style={styles.detailItem}>
                            <Icon name="person" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.inputField} value={name} onChangeText={setName} placeholder="Enter your full name" placeholderTextColor={InputPlaceholderColor} autoCapitalize="words" textContentType="name" returnKeyType="next" onSubmitEditing={() => phoneInputRef.current?.focus()} blurOnSubmit={false} editable={!isLoading}
                                />
                            </View>
                        </View>

                        {/* Phone */}
                        <View style={styles.detailItem}>
                            <Icon name="phone" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>Phone Number</Text>
                                <TextInput
                                    ref={phoneInputRef} style={styles.inputField} value={phone} onChangeText={handlePhoneChange} placeholder="Enter 11-digit phone number" placeholderTextColor={InputPlaceholderColor} keyboardType="numeric" maxLength={11} textContentType="telephoneNumber" returnKeyType="next" onSubmitEditing={() => streetInputRef.current?.focus()} blurOnSubmit={false} editable={!isLoading}
                                />
                            </View>
                        </View>

                        {/* Street Address */}
                        <View style={styles.detailItem}>
                            <Icon name="home" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>Street Address</Text>
                                <TextInput
                                    ref={streetInputRef} style={styles.inputField} value={streetAddress} onChangeText={setStreetAddress} placeholder="Building, street, area" placeholderTextColor={InputPlaceholderColor} autoCapitalize="words" textContentType="streetAddressLine1" returnKeyType="next" onSubmitEditing={() => cityInputRef.current?.focus()} blurOnSubmit={false} editable={!isLoading}
                                />
                            </View>
                        </View>

                        {/* City */}
                        <View style={styles.detailItem}>
                            <Icon name="location-city" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>City</Text>
                                <TextInput
                                    ref={cityInputRef} style={styles.inputField} value={city} onChangeText={setCity} placeholder="e.g., Karachi" placeholderTextColor={InputPlaceholderColor} autoCapitalize="words" textContentType="addressCity" returnKeyType="next" onSubmitEditing={() => provinceInputRef.current?.focus()} blurOnSubmit={false} editable={!isLoading}
                                />
                            </View>
                        </View>

                        {/* Province/State */}
                        <View style={styles.detailItem}>
                            <Icon name="map" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>Province / State</Text>
                                <TextInput
                                    ref={provinceInputRef} style={styles.inputField} value={province} onChangeText={setProvince} placeholder="e.g., Sindh" placeholderTextColor={InputPlaceholderColor} autoCapitalize="words" textContentType="addressState" returnKeyType="next" onSubmitEditing={() => postalInputRef.current?.focus()} blurOnSubmit={false} editable={!isLoading}
                                />
                            </View>
                        </View>

                        {/* Postal Code */}
                        <View style={styles.detailItem}>
                            <Icon name="local-post-office" size={30} color={THEME_RED} style={styles.detailIcon} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.label}>Postal Code (Optional)</Text>
                                <TextInput
                                    ref={postalInputRef} style={styles.inputField} value={postalCode} onChangeText={setPostalCode} placeholder="e.g., 75500" placeholderTextColor={InputPlaceholderColor} keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'} textContentType="postalCode" returnKeyType="done" onSubmitEditing={handleSaveChanges} editable={!isLoading}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.disabledButton]}
                        onPress={handleSaveChanges}
                        activeOpacity={0.8}
                        disabled={isLoading}
                    >
                        {isLoading ? (<ActivityIndicator size="small" color={ButtonTextColor} />) : (<Text style={styles.buttonText}>Save Details</Text>)}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
        // </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    // --- MODIFICATION: Changed container from SafeAreaView to View ---
    container: {
        flex: 1,
        backgroundColor: ScreenBackgroundColor,
        // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 // Optional: Handle Android status bar overlap if needed
    },
    // --- End Modification ---
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        flexGrow: 1,
        // --- MODIFICATION: Adjusted padding ---
        paddingTop: 15, // Reduced top padding
        paddingBottom: 30,
        // --- End Modification ---
    },
    detailsContainer: {
        paddingHorizontal: 20,
        // paddingTop: 20, // Removed specific top padding here, handled by scrollContentContainer
        backgroundColor: ScreenBackgroundColor,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: LightBorderColor,
    },
    detailIcon: {
        width: 30,
        textAlign: 'center',
        marginRight: 20,
    },
    detailTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    // --- MODIFICATION: Label style ---
    label: {
        fontSize: 14,
        color: TextColorSecondary, // Using the updated constant (#888)
        marginBottom: 4,
        fontWeight: '500',
    },
    // --- End Modification ---
    inputField: {
        fontSize: 17,
        paddingVertical: Platform.OS === 'ios' ? 8 : 6,
        color: TextColorPrimary,
    },
    saveButton: {
        backgroundColor: THEME_RED,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 30,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
        minHeight: 50,
    },
    buttonText: {
        color: ButtonTextColor,
        fontSize: 17,
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
        elevation: 0,
        shadowOpacity: 0,
    },
});