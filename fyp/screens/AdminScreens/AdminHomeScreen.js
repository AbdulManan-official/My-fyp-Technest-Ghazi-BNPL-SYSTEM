import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    TouchableOpacity,
    Image,
    StatusBar, // React Native StatusBar component
    ActivityIndicator,
    Platform,
    Alert
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/FontAwesome';
import AdminCustomDrawer from './AdminCustomDrawer';

// --- Start: Firebase & AsyncStorage Imports ---
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, limit, getDocs, FirestoreError } from 'firebase/firestore';
import { app } from '../../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
// --- End: Firebase & AsyncStorage Imports ---

const db = getFirestore(app);
console.log('Firestore Initialized:', db ? 'Yes' : 'No');

const screenWidth = Dimensions.get('window').width;

// --- Start: Constants ---
const ADMIN_PROFILE_IMAGE_KEY = 'adminHeaderProfileImage';
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
// --- End: Constants ---

// --- Chart Configurations (Keep as is) ---
const chartConfigBase = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 10 },
    propsForDots: { r: '6', strokeWidth: '2', stroke: '#36A2EB' },
};

const pieChartConfig = {
    ...chartConfigBase,
    color: (opacity = 1, index) => {
        const colors = ['#36A2EB', '#FF6384'];
        return colors[index % colors.length] || `rgba(200, 200, 200, ${opacity})`;
    },
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
};


export default function AdminHomeScreen({ navigation }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // --- State for User Chart Data (Keep as is) ---
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [errorUsers, setErrorUsers] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const [usersData, setUsersData] = useState([
        { name: 'Verified', population: 0, color: '#36A2EB', legendFontColor: '#333', legendFontSize: 14 },
        { name: 'Unverified', population: 0, color: '#FF6384', legendFontColor: '#333', legendFontSize: 14 },
    ]);

    // --- Start: State for Admin Profile Picture ---
    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    // --- End: State for Admin Profile Picture ---

    // --- Start: Fetch Admin Profile Image Logic ---
    const fetchAdminProfileImage = async () => {
        setLoadingProfile(true);
        const cacheKey = ADMIN_PROFILE_IMAGE_KEY;

        try {
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) {
                setProfileImage(cachedImage);
                setLoadingProfile(false);
                return;
            }

            console.log("Fetching admin profile image for header...");
            const adminQuery = query(collection(db, "Admin"), limit(1));
            const querySnapshot = await getDocs(adminQuery);

            if (!querySnapshot.empty) {
                const adminDoc = querySnapshot.docs[0];
                const data = adminDoc.data();
                const imageUrl = data.profileImage?.trim() || null;

                if (imageUrl) {
                    setProfileImage(imageUrl);
                    await AsyncStorage.setItem(cacheKey, imageUrl);
                    console.log("Admin profile image cached for header.");
                } else {
                    console.log("Admin document found, but no profileImage URL present.");
                    setProfileImage(null);
                    await AsyncStorage.removeItem(cacheKey);
                }
            } else {
                 console.warn("No documents found in the 'Admin' collection for profile image.");
                 setProfileImage(null);
                 await AsyncStorage.removeItem(cacheKey);
            }
        } catch (error) {
            console.error("Error fetching admin profile image:", error);
            if (!profileImage) {
                 setProfileImage(null);
            }
        } finally {
            setLoadingProfile(false);
        }
    };
    // --- End: Fetch Admin Profile Image Logic ---

    // --- Start: useEffect for Auth State and Profile Fetching ---
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchAdminProfileImage();
            } else {
                setProfileImage(null);
                setLoadingProfile(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);
    // --- End: useEffect for Auth State ---


    // --- Fetch User Data Effect (Keep as is) ---
    useEffect(() => {
        console.log('User data fetch effect starting...');
        const fetchUsersData = async () => {
            setLoadingUsers(true);
            setErrorUsers(null);
            setTotalUsers(0);
            try {
                console.log("Attempting to fetch users from 'Users' collection...");
                const usersCol = collection(db, 'Users');
                const userSnapshot = await getDocs(usersCol);
                console.log(`Fetched ${userSnapshot.size} user documents from 'Users'.`);

                setTotalUsers(userSnapshot.size);
                console.log(`Total users count set to: ${userSnapshot.size}`);

                if (userSnapshot.empty) {
                   console.warn("No documents found in the 'Users' collection.");
                }

                let verifiedCount = 0;
                let unverifiedCount = 0;

                userSnapshot.forEach((doc) => {
                    const userData = doc.data();
                    const status = userData.verificationStatus;

                    if (verifiedCount === 0 && unverifiedCount === 0 && userData) {
                       console.log("First user document data:", JSON.stringify(userData));
                       console.log(`Checking field: verificationStatus = ${status}`);
                    }

                    if (status === 'verified' || status === 'Verified') {
                        verifiedCount++;
                    } else {
                        unverifiedCount++;
                    }
                });

                console.log(`Processed counts - Verified: ${verifiedCount}, Unverified: ${unverifiedCount}`);

                const newUsersData = [
                    { ...usersData[0], population: verifiedCount },
                    { ...usersData[1], population: unverifiedCount },
                ];
                setUsersData(newUsersData);
                console.log('User verification status state updated.');

            } catch (err) {
                console.error("!!! Firebase Fetch Error (Users Collection):", err);
                let errorMessage = "Failed to load user data.";
                 if (err instanceof FirestoreError) {
                    errorMessage += ` (Code: ${err.code})`;
                    if (err.code === 'permission-denied') errorMessage = "Permission denied for 'Users' collection.";
                    else if (err.code === 'unauthenticated') errorMessage = "Authentication error.";
                } else if (err.message) errorMessage += ` (${err.message})`;
                setErrorUsers(errorMessage);
            } finally {
                setLoadingUsers(false);
                console.log('User data fetch attempt finished.');
            }
        };
        fetchUsersData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    return (
        <View style={styles.safeArea}>
             {/* ***** MODIFIED STATUS BAR ***** */}
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />
            {/* ******************************* */}

            {/* Header */}
            <View style={styles.headerBar}>
                <Image source={require('../../assets/pic2.jpg')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {loadingProfile ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Image
                                source={{ uri: profileImage || defaultProfileImageUri }}
                                style={styles.profileImageStyle}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContentContainer}
            >
                {/* User Status Pie Chart Section */}
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>👤 User Verification Status</Text>
                    {!loadingUsers && !errorUsers && (
                        <Text style={styles.totalUsersText}>Total Users: {totalUsers}</Text>
                    )}
                    <View style={styles.chartRenderArea}>
                        {loadingUsers ? (
                            <ActivityIndicator size="large" color="red" />
                        ) : errorUsers ? (
                            <Text style={styles.errorText}>{errorUsers}</Text>
                        ) : (
                            usersData.some(item => item.population > 0) || totalUsers > 0 ? (
                                <PieChart
                                    data={usersData.filter(item => item.population > 0)}
                                    width={screenWidth - 60}
                                    height={180}
                                    chartConfig={pieChartConfig}
                                    accessor="population"
                                    backgroundColor="transparent"
                                    paddingLeft="15"
                                    center={[10, 0]}
                                />
                            ) : (
                                <Text style={styles.noDataText}>No user status data available.</Text>
                            )
                        )}
                    </View>
                </View>

                {/* Total Orders Chart (Static Data) */}
                <Text style={styles.chartTitleOutside}>📦 Total Orders</Text>
                <View style={styles.chartContainer}>
                    <LineChart
                        data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                            datasets: [{ data: [20, 45, 28, 80, 99] }],
                        }}
                        width={screenWidth - 30}
                        height={220}
                        chartConfig={chartConfigBase}
                        bezier
                        style={styles.chartStyle}
                    />
                </View>

                {/* Total Sales Bar Chart (Static Data) */}
                <Text style={styles.chartTitleOutside}>💰 Total Sales (USD)</Text>
                 <View style={styles.chartContainer}>
                    <BarChart
                        data={{
                            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                            datasets: [{ data: [500, 1000, 750, 1200, 2000] }],
                        }}
                        width={screenWidth - 30}
                        height={240}
                        yAxisLabel="$"
                        chartConfig={chartConfigBase}
                        verticalLabelRotation={Platform.OS === 'android' ? 30 : 0}
                        style={styles.chartStyle}
                        fromZero={true}
                    />
                </View>

            </ScrollView>

            {/* Drawer Overlay */}
            {isDrawerOpen && (
                <View style={styles.drawerOverlay}>
                    <AdminCustomDrawer
                        navigation={navigation}
                        closeDrawer={() => setIsDrawerOpen(false)}
                    />
                </View>
            )}
        </View>
    );
}

// --- Styles --- (No changes needed in styles for this modification)
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FF0000', // Red header bar color
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
    },
    logo: {
        width: 90,
        height: 30,
        resizeMode: 'contain',
    },
    profileIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 40, // Circular
        borderWidth: 1, // Slightly thinner border
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#D32F2F', // Darker red placeholder bg
        overflow: 'hidden', // Important to clip the image
    },
    profileImageStyle: {
        width: '100%',
        height: '100%',
        borderRadius: 20, // Make the image circular *inside* the container
    },
    drawerOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    container: {
        flex: 1,
    },
    scrollContentContainer: {
       padding: 15,
       paddingBottom: 30,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#444',
        textAlign: 'center',
        marginBottom: 5,
        paddingHorizontal: 10,
    },
    chartTitleOutside: {
        fontSize: 18,
        fontWeight: '600',
        marginVertical: 10,
        marginTop: 15,
        color: '#444',
    },
    totalUsersText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#666',
        textAlign: 'center',
        marginBottom: 10,
    },
    chartContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingVertical: 15,
        paddingHorizontal: 10,
        marginBottom: 20,
        minHeight: 240,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    chartRenderArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 180,
    },
    chartStyle: {
       // Styles specific to the chart component if needed
    },
    errorText: {
        color: '#D8000C',
        backgroundColor: '#FFD2D2',
        padding: 10,
        borderRadius: 5,
        textAlign: 'center',
        fontSize: 15,
        marginHorizontal: 10,
    },
     noDataText: {
        color: '#555',
        textAlign: 'center',
        fontSize: 15,
        fontStyle: 'italic',
    }
}); // Ensure this closing bracket is present