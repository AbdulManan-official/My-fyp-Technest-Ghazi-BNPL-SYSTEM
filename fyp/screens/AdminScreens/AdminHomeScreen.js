import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    Image,
    StatusBar,
    ActivityIndicator,
    Platform,
    Alert,
    RefreshControl
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome';
import AdminCustomDrawer from './AdminCustomDrawer';

// --- Firebase & AsyncStorage Imports ---
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    getFirestore, collection, query, limit, FirestoreError,
    onSnapshot // Keep onSnapshot
} from 'firebase/firestore';
import { app } from '../../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const db = getFirestore(app);
const screenWidth = Dimensions.get('window').width;

// --- Constants ---
const ADMIN_PROFILE_IMAGE_KEY = 'adminHeaderProfileImage';
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
const REFRESH_CONTROL_COLOR = '#FF0000';

// --- *** CORRECTED Chart Configurations *** ---
const chartConfigBase = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`, // Default blue for line/bar
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
        borderRadius: 10,
    },
    propsForDots: {
        r: '6',
        strokeWidth: '2',
        stroke: '#36A2EB',
    },
};

const pieChartConfig = {
    // Spread the base config
    ...chartConfigBase,
    // Override color for PieChart slices based on index
    color: (opacity = 1, index) => {
        const colors = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
        return colors[index % colors.length] || `rgba(150, 150, 150, ${opacity})`;
    },
    // labelColor is inherited from chartConfigBase
    // propsForDots is inherited but ignored by PieChart
};
// --- *** End of Chart Configurations *** ---


export default function AdminHomeScreen({ navigation }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // User Chart State
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [errorUsers, setErrorUsers] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [usersData, setUsersData] = useState([
        { name: 'Verified', population: 0, color: '#36A2EB', legendFontColor: '#333', legendFontSize: 14 }, // Colors here are for legend if used separately
        { name: 'Unverified', population: 0, color: '#FF6384', legendFontColor: '#333', legendFontSize: 14 },
    ]);

    // Admin Profile State
    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // Refresh State
    const [refreshing, setRefreshing] = useState(false);

    // Listener Refs
    const adminProfileListenerUnsubscribe = useRef(null);
    const usersListenerUnsubscribe = useRef(null);

    // Initial Cache Check (Admin Profile)
    const checkInitialAdminProfileImage = useCallback(async () => {
        setLoadingProfile(true);
        const cacheKey = ADMIN_PROFILE_IMAGE_KEY;
        try {
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) {
                setProfileImage(cachedImage);
            }
        } catch (error) { console.error("Error reading admin profile image cache:", error); }
         finally { /* Wait for snapshot */ }
    }, []);

    // Auth State & Admin Profile Listener
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (adminProfileListenerUnsubscribe.current) {
                adminProfileListenerUnsubscribe.current(); adminProfileListenerUnsubscribe.current = null;
            }
            if (user) {
                checkInitialAdminProfileImage();
                const adminQuery = query(collection(db, "Admin"), limit(1));
                adminProfileListenerUnsubscribe.current = onSnapshot(adminQuery, async (querySnapshot) => {
                    if (!querySnapshot.empty) {
                        const adminDoc = querySnapshot.docs[0]; const data = adminDoc.data();
                        const imageUrl = data.profileImage?.trim() || null; const cacheKey = ADMIN_PROFILE_IMAGE_KEY;
                        setProfileImage(imageUrl);
                        try { if (imageUrl) { await AsyncStorage.setItem(cacheKey, imageUrl); } else { await AsyncStorage.removeItem(cacheKey); } }
                        catch (cacheError) { console.error("Error updating admin profile cache:", cacheError); }
                    } else {
                        setProfileImage(null); try { await AsyncStorage.removeItem(ADMIN_PROFILE_IMAGE_KEY); } catch(e){}
                    }
                    setLoadingProfile(false);
                }, (error) => { console.error("Error listening admin profile:", error); setProfileImage(null); setLoadingProfile(false); });
            } else { setProfileImage(null); setLoadingProfile(false); }
        });
        return () => { unsubscribeAuth(); if (adminProfileListenerUnsubscribe.current) { adminProfileListenerUnsubscribe.current(); } };
    }, [checkInitialAdminProfileImage]);

    // Users Collection Listener
    useEffect(() => {
        setLoadingUsers(true); setErrorUsers(null);
        const usersColRef = collection(db, 'Users');
        usersListenerUnsubscribe.current = onSnapshot(usersColRef, (snapshot) => {
            setTotalUsers(snapshot.size); let verifiedCount = 0; let unverifiedCount = 0;
            snapshot.forEach((doc) => { const status = doc.data().verificationStatus; if (status === 'verified' || status === 'Verified') { verifiedCount++; } else { unverifiedCount++; } });
            const newUsersData = [ { ...usersData[0], population: verifiedCount }, { ...usersData[1], population: unverifiedCount }, ];
            setUsersData(newUsersData); setLoadingUsers(false); setErrorUsers(null);
        }, (error) => {
            console.error("Firebase Snapshot Error (Users):", error); let errorMessage = "Failed real-time user data.";
            if (error instanceof FirestoreError) { errorMessage += ` (Code: ${error.code})`; if (error.code === 'permission-denied') errorMessage = "Permission denied Users listener."; }
            setErrorUsers(errorMessage); setLoadingUsers(false); setTotalUsers(0); setUsersData([ { ...usersData[0], population: 0 }, { ...usersData[1], population: 0 }, ]);
        });
        return () => { if (usersListenerUnsubscribe.current) { usersListenerUnsubscribe.current(); } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Simplified onRefresh Handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => { setRefreshing(false); }, 1000);
    }, []);

    // --- Render ---
    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />

            {/* Header */}
            <View style={styles.headerBar}>
                <Image source={require('../../assets/pic2.jpg')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {loadingProfile ? <ActivityIndicator size="small" color="white" /> : <Image source={{ uri: profileImage || defaultProfileImageUri }} style={styles.profileImageStyle} />}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContentContainer}
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={REFRESH_CONTROL_COLOR} colors={[REFRESH_CONTROL_COLOR]} progressBackgroundColor="#ffffff" /> }
            >
                {/* User Status Pie Chart Section */}
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>👤 User Verification Status</Text>
                    {!loadingUsers && !errorUsers && <Text style={styles.totalUsersText}>Total Users: {totalUsers}</Text>}
                    <View style={styles.chartRenderArea}>
                        {loadingUsers ? <ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} />
                         : errorUsers ? <Text style={styles.errorText}>{errorUsers}</Text>
                         : (usersData.some(item => item.population > 0) || totalUsers > 0) ?
                            <PieChart
                                data={usersData.filter(item => item.population > 0)}
                                width={screenWidth - 60}
                                height={180}
                                chartConfig={pieChartConfig} // *** Use the corrected config ***
                                accessor="population"
                                backgroundColor="transparent"
                                paddingLeft="15"
                                center={[10, 0]}
                            />
                          : <Text style={styles.noDataText}>No user status data available.</Text>}
                    </View>
                </View>

                {/* Total Orders Chart (Static Data) */}
                <Text style={styles.chartTitleOutside}>📦 Total Orders</Text>
                <View style={styles.chartContainer}>
                    <LineChart
                        data={{ labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], datasets: [{ data: [20, 45, 28, 80, 99] }], }}
                        width={screenWidth - 30} height={220}
                        chartConfig={chartConfigBase} // *** Use base config ***
                        bezier style={styles.chartStyle}
                    />
                </View>

                {/* Total Sales Bar Chart (Static Data) */}
                <Text style={styles.chartTitleOutside}>💰 Total Sales (USD)</Text>
                 <View style={styles.chartContainer}>
                    <BarChart
                        data={{ labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], datasets: [{ data: [500, 1000, 750, 1200, 2000] }], }}
                        width={screenWidth - 30} height={240} yAxisLabel="$"
                        chartConfig={chartConfigBase} // *** Use base config ***
                        verticalLabelRotation={Platform.OS === 'android' ? 30 : 0} style={styles.chartStyle} fromZero={true}
                    />
                </View>
            </ScrollView>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
                <View style={styles.drawerOverlay}>
                    <AdminCustomDrawer navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
            )}
        </View>
    );
}

// --- Styles --- (Keep your existing styles)
const styles = StyleSheet.create({
   /* ... Your existing styles ... */
    safeArea: { flex: 1, backgroundColor: '#F5F5F5', },
    headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 90, height: 30, resizeMode: 'contain', },
    profileIconContainer: { width: 50, height: 50, borderRadius: 40, borderWidth: 1, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: '#D32F2F', overflow: 'hidden', },
    profileImageStyle: { width: '100%', height: '100%', borderRadius: 20, },
    drawerOverlay: { position: 'absolute', top: 0, bottom: 0, right: 0, left: 0, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.3)', },
    container: { flex: 1, },
    scrollContentContainer: { padding: 15, paddingBottom: 30, },
    chartTitle: { fontSize: 18, fontWeight: '600', color: '#444', textAlign: 'center', marginBottom: 5, paddingHorizontal: 10, },
    chartTitleOutside: { fontSize: 18, fontWeight: '600', marginVertical: 10, marginTop: 15, color: '#444', },
    totalUsersText: { fontSize: 16, fontWeight: '500', color: '#666', textAlign: 'center', marginBottom: 10, },
    chartContainer: { backgroundColor: '#ffffff', borderRadius: 10, paddingVertical: 15, paddingHorizontal: 10, marginBottom: 20, minHeight: 240, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.23, shadowRadius: 2.62, elevation: 4, },
    chartRenderArea: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 180, },
    chartStyle: { /* Styles specific to chart components */ },
    errorText: { color: '#D8000C', backgroundColor: '#FFD2D2', padding: 10, borderRadius: 5, textAlign: 'center', fontSize: 15, marginHorizontal: 10, },
    noDataText: { color: '#555', textAlign: 'center', fontSize: 15, fontStyle: 'italic', }
});