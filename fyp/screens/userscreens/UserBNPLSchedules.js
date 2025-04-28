// UserBNPLSchedules.js - FINAL COMPLETE CODE v7 - Text Warning Check
// Displays BNPL, Fixed Duration, and Mixed Orders FOR THE LOGGED-IN USER.
// Includes RED Header (#FF0000), Search, All/Active/Completed Filters.
// Items: Full width, minimal spacing. Price BLACK, Primary text PRODUCT NAME, Status centered right.
// Navigates to SchedulesDetailScreen, passing the full order object.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, Platform, Alert, TextInput, ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// Using MCommunityIcons for header icons
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MaterialIcons } from '@expo/vector-icons'; // Keep MaterialIcons for item date icon
import { db, auth } from '../../firebaseConfig'; // Verify path
import {
    collection, query, where, onSnapshot, Timestamp, orderBy
} from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Ensure 'date-fns' is installed

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121'; // Black color for text
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';      // Red Accent Color for Header
const HeaderIconColor = '#FFFFFF'; // White icons on Red header

// Color Definitions
const ItemAccentColor = TextColorPrimary; // Using Black for item price
const InstallmentColor = '#4CAF50';
const FixedDurationColor = '#2196F3';
const MixedColor = '#9C27B0';
const PendingColor = '#FFA726';
const ProcessingColor = '#42A5F5';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const ActiveColor = '#29B6F6';
const CancelledColor = '#EF5350';
const SuccessColor = '#4CAF50';
const PaidColor = SuccessColor;
const UnknownColor = '#BDBDBD';
const PlaceholderBgColor = '#F0F0F0';
const ItemSeparatorColor = '#EEEEEE';

const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment';
const PAID_STATUS = 'Paid';
const ACTIVE_ORDER_STATUS = 'Active';
const DELIVERED_ORDER_STATUS = 'Delivered';

const SCHEDULE_PAYMENT_METHODS = [BNPL_TYPE, FIXED_TYPE, MIXED_TYPE];
const DETAIL_SCREEN_ROUTE_NAME = 'SchedulesDetailScreen';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****

// Filter Configuration
const ACTIVE_SCHEDULE_STATUSES = [ACTIVE_ORDER_STATUS.toLowerCase()];
const COMPLETED_SCHEDULE_STATUSES = [DELIVERED_ORDER_STATUS.toLowerCase(), PAID_STATUS.toLowerCase()];
const SCHEDULE_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Active', filterValue: 'Active' },
  { displayName: 'Completed', filterValue: 'Completed' },
];

// --- Helper Functions ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {} }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }}
    return 'N/A';
};
const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': case 'completed': return styles.statusDelivered;
        case ACTIVE_ORDER_STATUS.toLowerCase(): return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case PAID_STATUS.toLowerCase(): return styles.statusPaid;
        default: return styles.statusUnknown;
    }
};
const getPaymentMethodStyle = (type) => {
    const lowerType = type?.toLowerCase();
    switch (lowerType) {
        case BNPL_TYPE.toLowerCase(): return styles.typeInstallment;
        case FIXED_TYPE.toLowerCase(): return styles.typeFixed;
        case MIXED_TYPE.toLowerCase(): return styles.typeMixed;
        default: return styles.typeUnknown;
    }
};
// --- End Helper Functions ---

// --- Main Component ---
export default function UserBNPLSchedules() {
    const navigation = useNavigation();
    const [scheduleOrders, setScheduleOrders] = useState([]); // Raw fetched data
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [dbError, setDbError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const listenerUnsubscribeRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All'); // Default filter

    // --- Effect 1: Monitor Authentication State ---
    useEffect(() => {
        console.log("[UserBNPLSchedules] Attaching Auth listener.");
        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            const currentUid = user ? user.uid : null;
            console.log("[UserBNPLSchedules] Auth State Changed. User ID:", currentUid);
            if (currentUid !== userId) {
                setUserId(currentUid);
                setScheduleOrders([]); setDbError(null);
                setSearchQuery(''); setFilter('All');
                if (!currentUid) {
                    setLoading(false); setRefreshing(false);
                    if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }
                } else {
                    if (scheduleOrders.length === 0) setLoading(true);
                }
            }
        });
        return () => { console.log("[UserBNPLSchedules] Cleaning up Auth Listener."); unsubscribeAuth(); };
    }, [userId, scheduleOrders.length]);


    // --- Effect 2 / Function: Setup Firestore Listener ---
    const setupScheduleListener = useCallback(() => {
        // Firestore Index Reminder
        if (!userId) { console.log("[UserBNPLSchedules] No userId."); setScheduleOrders([]); setLoading(false); setRefreshing(false); setDbError(null); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } return; }
        if (listenerUnsubscribeRef.current) { console.log("[UserBNPLSchedules] Detaching previous listener."); listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }
        if (!refreshing && scheduleOrders.length === 0) setLoading(true);
        setDbError(null);
        console.log(`[UserBNPLSchedules] Setting up listener for user ${userId}, types: ${SCHEDULE_PAYMENT_METHODS.join(', ')}.`);
        const ordersRef = collection(db, ORDERS_COLLECTION);
        const q = query(
            ordersRef,
            where("userId", "==", userId),
            where("paymentMethod", "in", SCHEDULE_PAYMENT_METHODS),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
             console.log(`[UserBNPLSchedules] Snapshot: Received ${snapshot.docs.length} orders.`);
             let fetchedOrders = snapshot.docs.map(docSnap => {
                 const data = docSnap.data();
                 if (!data || !(data.createdAt instanceof Timestamp)) { console.warn(`[UserBNPLSchedules] Skipping order ${docSnap.id}: Invalid data/createdAt.`); return null; }
                 return { id: docSnap.id, ...data };
             }).filter(item => item !== null);
             setScheduleOrders(fetchedOrders);
             setLoading(false); setRefreshing(false); setDbError(null);
         }, (error) => {
             setLoading(false); setRefreshing(false); setScheduleOrders([]);
             if (error.code === 'failed-precondition') {
                 const errorMsg = "Database Index Required (userId ASC, paymentMethod ASC, createdAt DESC). Ask admin."; setDbError(errorMsg); Alert.alert("Config Error", errorMsg);
             } else {
                 const errorMsg = "Could not fetch schedules."; setDbError(errorMsg); Alert.alert("Fetch Error", errorMsg); console.error("[UserBNPLSchedules] Listener error:", error);
             }
         });
        listenerUnsubscribeRef.current = unsubscribe;
    }, [userId, refreshing, scheduleOrders.length]);


    // --- Effect 3: Manage Listener Lifecycle ---
    useFocusEffect(useCallback(() => { console.log("[UserBNPLSchedules] Screen focused."); setupScheduleListener(); return () => { if (listenerUnsubscribeRef.current) { console.log("[UserBNPLSchedules] Screen blurred."); listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }; }, [setupScheduleListener]));

    // --- Client-Side Filtering Logic ---
    const filteredOrders = useMemo(() => {
        console.log(`Filtering ${scheduleOrders.length} orders. Query: "${searchQuery}", Filter: "${filter}"`);
        return scheduleOrders.filter(order => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = ( !searchQuery || (order.id.toLowerCase().includes(searchLower)) || (order.orderNumber?.toLowerCase().includes(searchLower)) || (order.items?.[0]?.name?.toLowerCase().includes(searchLower)) );
            const filterValue = filter;
            const orderStatusLower = order.status?.toLowerCase();
            let matchesFilter = false;
            if (filterValue === 'All') { matchesFilter = true; }
            else if (filterValue === 'Active') { matchesFilter = ACTIVE_SCHEDULE_STATUSES.includes(orderStatusLower); }
            else if (filterValue === 'Completed') { matchesFilter = COMPLETED_SCHEDULE_STATUSES.includes(orderStatusLower); }
            return matchesSearch && matchesFilter;
        });
    }, [scheduleOrders, searchQuery, filter]);

    // --- Handlers ---
    const onRefresh = useCallback(() => { if (!userId) { setRefreshing(false); return; } setRefreshing(true); setupScheduleListener(); const t = setTimeout(() => { if (refreshing) setRefreshing(false); }, 8000); return () => clearTimeout(t); }, [userId, refreshing, setupScheduleListener]);
    const handleOrderPress = (orderItem) => { if (!orderItem?.id) { Alert.alert("Error","Cannot open details."); return; } navigation.navigate(DETAIL_SCREEN_ROUTE_NAME, { order: orderItem }); };
    const handleGoBack = () => { navigation.goBack(); };
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterChange = (newFilterValue) => { setFilter(newFilterValue); };

    // --- Render Item Function ---
    const renderOrderItem = ({ item }) => {
        const displayId = item.orderNumber ? `#${item.orderNumber}` : `#${item.id.substring(0, 6).toUpperCase()}`;
        const orderStatus = item.status || 'Unknown';
        const paymentMethod = item.paymentMethod || 'Unknown';
        const paymentDisplayLabel = paymentMethod === MIXED_TYPE ? MIXED_TYPE : (paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : paymentMethod);
        const firstItem = item.items && item.items.length > 0 ? item.items[0] : null;
        const imageSource = firstItem?.image ? { uri: firstItem.image } : placeholderImagePath;
        const primaryDisplayText = firstItem?.name || displayId;

        return (
            <TouchableOpacity style={styles.itemContainerTouchable} onPress={() => handleOrderPress(item)} activeOpacity={0.7}>
                <View style={styles.itemContentRow}>
                    <Image source={imageSource} style={styles.orderItemImage} defaultSource={placeholderImagePath}/>
                    <View style={styles.mainDetailsColumn}>
                        <Text style={styles.primaryDisplayText} numberOfLines={1}>{primaryDisplayText}</Text>
                        <View style={styles.secondaryInfoRow}>
                            <MaterialIcons name="event" size={14} color={TextColorSecondary} style={styles.iconStyle} />
                            <Text style={styles.detailText}>{formatShortDate(item.createdAt || item.orderDate)}</Text>
                        </View>
                        <View style={styles.paymentTypeContainer}>
                             <View style={[styles.typeBadge, getPaymentMethodStyle(paymentMethod)]}>
                                 <Text style={styles.typeText}>{paymentDisplayLabel}</Text>
                             </View>
                        </View>
                        <Text style={styles.totalValueText} numberOfLines={1}>
                             {CURRENCY_SYMBOL} {(item.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                    <View style={styles.rightColumn}>
                        <View style={[styles.statusBadge, getStatusStyle(orderStatus)]}>
                            <Text style={styles.statusText}>{orderStatus}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
     };

    // --- Separator ---
    const renderSeparator = () => <View style={styles.separator} />;

    // --- Loading State ---
    if (loading && filteredOrders.length === 0 && !refreshing) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="light-content" backgroundColor={AccentColor} />
                <ActivityIndicator size="large" color={AccentColor} />
                <Text style={styles.loadingText}>Loading Schedules...</Text>
            </SafeAreaView>
        );
    }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
             <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

             {/* --- Header --- */}
             <View style={styles.headerContainer}>
                 <View style={styles.headerTopRow}>
                    <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                        <Icon name="arrow-left" size={24} color={HeaderIconColor} />
                    </TouchableOpacity>
                    <View style={styles.searchBar}>
                        <Icon name="magnify" size={20} color={AccentColor} style={styles.searchIcon} />
                        <TextInput style={styles.searchInput} placeholder="Search Product or Order ID..." placeholderTextColor="#888" value={searchQuery} onChangeText={onSearchInputChange} returnKeyType="search" autoCapitalize="none" autoCorrect={false}/>
                        {searchQuery.length > 0 && ( <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}><Icon name="close-circle" size={18} color={AccentColor} /></TouchableOpacity> )}
                    </View>
                </View>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                     {SCHEDULE_FILTERS.map(filterItem => (
                         <TouchableOpacity key={filterItem.filterValue} style={[ styles.filterButton, filter === filterItem.filterValue && styles.activeFilter ]} onPress={() => onFilterChange(filterItem.filterValue)} >
                             <Text style={[ styles.filterText, filter === filterItem.filterValue && styles.activeFilterText ]}>{filterItem.displayName}</Text>
                         </TouchableOpacity>
                     ))}
                 </ScrollView>
             </View>

             {/* Inline Error Banner */}
             {dbError && !loading && scheduleOrders.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {dbError}</Text></View> )}

            {/* --- List --- */}
            <FlatList
                data={filteredOrders} // Use filtered data
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContainer, filteredOrders.length === 0 && styles.emptyListContainer]}
                ListEmptyComponent={ // Use curly braces for the component function body
                    !loading && (
                        userId ? (
                            dbError ? (
                                <View style={styles.emptyView}>
                                    <MaterialIcons name="error-outline" size={60} color={CancelledColor} />
                                    <Text style={styles.errorText}>{dbError}</Text>
                                    {/* Conditional rendering needs a check */}
                                    {dbError !== "Database Index Required (userId ASC, paymentMethod ASC, createdAt DESC). Ask admin." && (
                                        <TouchableOpacity onPress={setupScheduleListener} style={styles.retryButton}>
                                            <Text style={styles.retryButtonText}>Retry</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                             )
                            : ( // No error, but list empty
                                <View style={styles.emptyView}>
                                    <Icon name={searchQuery || filter !== 'All' ? "filter-variant-remove" : "credit-card-off-outline"} size={50} color="#ccc"/>
                                    {/* Text content must be inside Text component */}
                                    <Text style={styles.emptyText}>
                                        {searchQuery || filter !== 'All' ? "No schedules match criteria." : "No payment schedules found."}
                                    </Text>
                                    {/* Conditional Text rendering */}
                                    {scheduleOrders.length > 0 && (searchQuery || filter !== 'All') && (
                                        <Text style={styles.emptyDetailText}>(Found {scheduleOrders.length} total)</Text>
                                    )}
                                </View>
                             )
                        ) : ( // Logged out view
                             <View style={styles.emptyView}>
                                 <Icon name="login" size={50} color="#ccc"/>
                                 <Text style={styles.emptyText}>Please log in.</Text>
                             </View>
                         )
                    )
                 } // Added closing curly brace for ListEmptyComponent function body
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} /> }
                ItemSeparatorComponent={renderSeparator}
            />
        </SafeAreaView>
    );
}

// --- Styles --- (Includes Header and Adjusted Item Styles)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    loadingText: { marginTop: 10, color: TextColorSecondary, fontSize: 14, },
    errorText: { color: CancelledColor, fontSize: 16, textAlign: 'center', marginTop: 15, lineHeight: 22 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 20 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    // --- Header Styles (Using Red AccentColor) ---
    headerContainer: {
        backgroundColor: AccentColor, // Red header
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 10,
        paddingHorizontal: 10,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3,
        marginBottom: 5, // Small margin below header
    },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5, },
    backButton: { padding: 6, marginRight: 6, },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 13, height: 40, },
    searchIcon: { marginRight: 8, color: AccentColor },
    searchInput: { flex: 1, fontSize: 14, color: '#333', },
    clearSearchButton: { padding: 4, marginLeft: 4, },
    filterScroll: { paddingLeft:10 },
    filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor, borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 32, },
    filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
    activeFilter: { backgroundColor: '#000000', borderColor: '#000000', }, // Black active filter
    activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },
    // --- List Styles ---
    listContainer: { paddingBottom: 15, },
    emptyListContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    // Item Styles (Full Width, Layout Adjusted)
    itemContainerTouchable: { backgroundColor: AppBackgroundColor, },
    itemContentRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, alignItems: 'center', },
    separator: { height: 1, backgroundColor: ItemSeparatorColor, },
    orderItemImage: { width: 55, height: 55, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor, },
    mainDetailsColumn: { flex: 1, justifyContent: 'center', marginRight: 8, },
    rightColumn: { width: 90, justifyContent: 'center', alignItems: 'flex-end', alignSelf: 'stretch', }, // Centered vertically
    // --- Style for Primary Text (Product Name/ID) ---
    primaryDisplayText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: TextColorPrimary, // Black
        marginBottom: 4,
    },
    secondaryInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, },
    detailText: { fontSize: 12, color: TextColorSecondary, },
    iconStyle: { marginRight: 5, },
    paymentTypeContainer: { alignItems: 'flex-start', marginTop: 4, marginBottom: 4, },
    typeBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, },
    typeText: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
    // --- Price Style (Black Color) ---
    totalValueText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: TextColorPrimary, // Black color for price
        marginTop: 6,
    },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, },
    statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 10, textAlign: 'center', },
    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 50, },
    emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15, lineHeight: 22, },
     emptyDetailText: { fontSize: 12, color: TextColorSecondary, marginTop: 5, },
    // --- Badge/Status Background Colors ---
    statusPending: { backgroundColor: PendingColor },
    statusProcessing: { backgroundColor: ProcessingColor },
    statusShipped: { backgroundColor: ShippedColor },
    statusDelivered: { backgroundColor: DeliveredColor },
    statusActive: { backgroundColor: ActiveColor },
    statusCancelled: { backgroundColor: CancelledColor },
    statusPaid: { backgroundColor: PaidColor },
    statusUnknown: { backgroundColor: UnknownColor },
    // --- Payment Type Badge Background Colors ---
    typeInstallment: { backgroundColor: InstallmentColor },
    typeFixed: { backgroundColor: FixedDurationColor },
    typeMixed: { backgroundColor: MixedColor },
    typeUnknown: { backgroundColor: TextColorSecondary },
});