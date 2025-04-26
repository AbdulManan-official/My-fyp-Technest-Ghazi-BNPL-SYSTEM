// AdminSideUserSchedulesProgress.js
// Lists Orders - RICH UI - Total Bottom-Right, Status Centered-Right

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, TextInput, ScrollView, Dimensions, Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
    getFirestore, collection, getDocs, query, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // **** Ensure this path is correct ****
import { format, isValid } from 'date-fns';

// --- Constants --- (Unchanged from previous version)
const { width } = Dimensions.get('window');
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F5F5F5';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const InstallmentColor = '#4CAF50';
const FixedDurationColor = '#2196F3';
const PlaceholderBgColor = '#F0F0F0';
const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const INSTALLMENT_LABEL = 'Installment';
const DETAIL_SCREEN_ROUTE_NAME = 'UserSchedulesProgressDetails';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****
const SCHEDULE_FILTERS = [ /* ... */ { displayName: 'All', filterValue: 'All' }, { displayName: 'Installment', filterValue: INSTALLMENT_LABEL }, { displayName: 'Fixed Duration', filterValue: FIXED_TYPE }, ];

// --- Helper Functions (formatShortDate, getStatusStyle, getPaymentMethodStyle) ---
// (Keep the helper functions from the previous version - they are unchanged)
const formatShortDate = (timestamp) => { /* ... */ let dateToFormat = null; if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); } else if (timestamp instanceof Date) { dateToFormat = timestamp; } else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {} } if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }} return timestamp ? 'Invalid Date' : 'Pending Date'; };
const getStatusStyle = (status) => { /* ... */ const lowerStatus = status?.toLowerCase() || 'unknown'; switch (lowerStatus) { case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending; case 'processing': case 'partially paid': return styles.statusProcessing; case 'shipped': return styles.statusShipped; case 'delivered': return styles.statusDelivered; case 'active': return styles.statusActive; case 'cancelled': case 'rejected': return styles.statusCancelled; case 'paid': return styles.statusPaid; default: return styles.statusUnknown; } };
const getPaymentMethodStyle = (type) => { /* ... */ const lowerType = type?.toLowerCase(); switch (lowerType) { case BNPL_TYPE.toLowerCase(): return styles.typeInstallment; case FIXED_TYPE.toLowerCase(): return styles.typeFixed; default: return styles.typeUnknown; } };
// --- End Helper Functions ---

// --- Main Component ---
export default function AdminSideUserSchedulesProgress() {
    const navigation = useNavigation();
    const [allFetchedOrdersRaw, setAllFetchedOrdersRaw] = useState([]);
    const [paymentFilteredOrders, setPaymentFilteredOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // --- Fetch ALL Orders Function ---
    // (Keep the fetchAllOrders logic from the previous version - unchanged)
    const fetchAllOrders = useCallback(async () => { /* ... */ if (!refreshing) setLoading(true); setError(null); console.log("Fetching ALL orders..."); try { const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc')); const querySnapshot = await getDocs(q); const fetchedOrders = []; querySnapshot.forEach((doc) => { const data = doc.data(); if (data && data.createdAt) { fetchedOrders.push({ id: doc.id, ...data }); } else { console.warn(`Skipping order ${doc.id}`); } }); setAllFetchedOrdersRaw(fetchedOrders); console.log(`Fetched ${fetchedOrders.length} total orders.`); const initialFiltered = fetchedOrders.filter(order => order.paymentMethod === BNPL_TYPE || order.paymentMethod === FIXED_TYPE); setPaymentFilteredOrders(initialFiltered); console.log(`Filtered to ${initialFiltered.length} orders.`); } catch (err) { console.error("Error fetching orders:", err); setError("Failed to load orders."); setAllFetchedOrdersRaw([]); setPaymentFilteredOrders([]); } finally { setLoading(false); setRefreshing(false); } }, [refreshing]);

    // --- Fetch data on initial load and focus ---
    useFocusEffect(useCallback(() => { fetchAllOrders(); }, [fetchAllOrders]));

    // --- Memoized Filtering for UI ---
    // (Keep the useMemo logic for displayOrders from the previous version - unchanged)
    const displayOrders = useMemo(() => { /* ... */ console.log(`Applying UI Filters. Search: "${searchQuery}", Filter: "${filter}"`); return paymentFilteredOrders.filter(order => { const searchLower = searchQuery.toLowerCase(); const matchesSearch = (!searchQuery || (order.id.toLowerCase().includes(searchLower)) || (order.orderNumber?.toLowerCase().includes(searchLower)) || (order.userName?.toLowerCase().includes(searchLower)) || (order.items?.[0]?.name?.toLowerCase().includes(searchLower))); const paymentDisplayLabel = order.paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : order.paymentMethod; const matchesFilter = (filter === 'All' || paymentDisplayLabel === filter); return matchesSearch && matchesFilter; }); }, [paymentFilteredOrders, searchQuery, filter]);

    // --- Handle Pull-to-Refresh ---
    const onRefresh = useCallback(() => { setRefreshing(true); fetchAllOrders(); }, [fetchAllOrders]);

    // --- Handle Navigation ---
    const handleOrderPress = (orderItem) => { /* ... */ if (!orderItem || !orderItem.id) return; navigation.navigate(DETAIL_SCREEN_ROUTE_NAME, { order: orderItem }); };

    // --- Event Handlers for Header ---
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterChange = (newFilterValue) => { console.log("Filter changed to:", newFilterValue); setFilter(newFilterValue); };

    // --- Render Function for Each Order Item (UPDATED LAYOUT) ---
    const renderOrderItem = ({ item }) => {
        const displayId = item.orderNumber ? `#${item.orderNumber}` : `#${item.id.substring(0, 6).toUpperCase()}`;
        const orderStatus = item.status || 'Unknown';
        const paymentMethod = item.paymentMethod || 'Unknown';
        const paymentDisplayLabel = paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : paymentMethod;
        const firstItemImage = item.items && item.items.length > 0 ? item.items[0]?.image : null;
        const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;

        return (
            <TouchableOpacity
                style={styles.itemContainerTouchable} // Use touchable specific style
                onPress={() => handleOrderPress(item)}
                activeOpacity={0.8}
            >
                {/* Inner container for content layout */}
                <View style={styles.itemContentRow}>
                    {/* Image Section */}
                    <Image source={imageSource} style={styles.orderItemImage} defaultSource={placeholderImagePath}/>

                    {/* Details Column (takes up most space) */}
                    <View style={styles.mainDetailsColumn}>
                        <Text style={styles.orderIdentifierText} numberOfLines={1}>{displayId}</Text>

                        <View style={styles.userInfoRow}>
                            <MaterialIcons name="person-outline" size={15} color={TextColorSecondary} style={styles.iconStyle} />
                            <Text style={styles.customerTextValue} numberOfLines={1}>{item.userName || 'N/A'}</Text>
                        </View>

                        <View style={styles.secondaryInfoRow}>
                            <MaterialIcons name="event" size={14} color={TextColorSecondary} style={styles.iconStyle} />
                            <Text style={styles.detailText}>{formatShortDate(item.createdAt || item.orderDate)}</Text>
                        </View>

                        {/* Payment Type Badge */}
                        <View style={styles.paymentTypeContainer}>
                             <View style={[styles.typeBadge, getPaymentMethodStyle(paymentMethod)]}>
                                <Text style={styles.typeText}>{paymentDisplayLabel}</Text>
                            </View>
                        </View>
                    </View>

                     {/* Right Side Column (Total and Status) */}
                     <View style={styles.rightColumn}>
                         {/* Status is absolutely positioned relative to TouchableOpacity */}
                         {/* Total is at the bottom of this column */}
                         <Text style={styles.totalValueText} numberOfLines={1}>
                             {CURRENCY_SYMBOL} {(item.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                         </Text>
                     </View>
                 </View>

                  {/* Absolutely Positioned Status Badge */}
                 <View style={styles.statusContainerAbsolute}>
                     <View style={[styles.statusBadge, getStatusStyle(orderStatus)]}>
                         <Text style={styles.statusText}>{orderStatus}</Text>
                     </View>
                 </View>
            </TouchableOpacity>
        );
    };

    // --- Loading / Error / Empty States ---
    // (Keep the Loading/Error/Empty components from the previous version - unchanged)
    if (loading && displayOrders.length === 0 && !refreshing) { /* ... */ return (<SafeAreaView style={styles.centeredContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading Orders...</Text></SafeAreaView>); }
    if (error && displayOrders.length === 0 && !loading) { /* ... */ return (<SafeAreaView style={styles.centeredContainer}><Text style={styles.errorTextTitle}>Error Loading Orders</Text><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={fetchAllOrders} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity></SafeAreaView>); }
    // --- End Loading/Error ---

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

             {/* Header Section */}
            <View style={styles.headerContainer}>
                <View style={styles.searchBar}>
                    {/* ... search input ... */}
                     <MaterialCommunityIcons name="magnify" size={22} color={AccentColor} style={styles.searchIcon} />
                     <TextInput style={styles.searchInput} placeholder="Search User or Order ID..." placeholderTextColor="#888" value={searchQuery} onChangeText={onSearchInputChange} returnKeyType="search" autoCapitalize="none" autoCorrect={false}/>
                     {searchQuery.length > 0 && (<TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}><MaterialCommunityIcons name="close-circle" size={20} color={AccentColor} /></TouchableOpacity>)}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {/* ... filter buttons ... */}
                     {SCHEDULE_FILTERS.map(filterItem => (<TouchableOpacity key={filterItem.filterValue} style={[ styles.filterButton, filter === filterItem.filterValue && styles.activeFilter ]} onPress={() => onFilterChange(filterItem.filterValue)} ><Text style={[ styles.filterText, filter === filterItem.filterValue && styles.activeFilterText ]}>{filterItem.displayName}</Text></TouchableOpacity>))}
                </ScrollView>
            </View>

            {/* Error Banner */}
            {error && displayOrders.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {error}</Text></View> )}

            {/* Order List */}
            <FlatList
                data={displayOrders}
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={ /* ... */ !loading && !error ? ( <View style={styles.emptyView}><MaterialCommunityIcons name="clipboard-text-outline" size={50} color="#ccc"/><Text style={styles.emptyText}>No orders match your criteria.</Text>{paymentFilteredOrders.length > 0 && ( <Text style={styles.emptyTextDetail}>({paymentFilteredOrders.length} Installment/Fixed orders available)</Text>)}</View> ) : null }
                refreshControl={ /* ... */ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} /> }
                ItemSeparatorComponent={() => <View style={styles.separator} />} // Add separator line
            />
        </SafeAreaView>
    );
}

// --- Styles --- (UPDATED ITEM LAYOUT STYLES)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

    // --- Header Styles (from OrderScreen) ---
    headerContainer: { backgroundColor: AccentColor, paddingTop: Platform.OS === 'ios' ? 10 : 20, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginBottom: 5, },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 15, height: 45, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, marginBottom: 12, },
    searchIcon: { marginRight: 10, },
    searchInput: { flex: 1, fontSize: 15, color: '#333', },
    clearSearchButton: { padding: 5, marginLeft: 5, },
    filterScroll: { marginTop: 3, },
    filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor, borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 34, },
    filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
    activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
    activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },

    // --- List Styles ---
    listContainer: { paddingBottom: 15, paddingTop: 0 }, // Removed top padding
    itemContainerTouchable: { // Style for the outer TouchableOpacity
         backgroundColor: AppBackgroundColor,
         position: 'relative', // Needed for absolute positioning of children (status badge)
    },
    itemContentRow: { // Inner View to hold image and details side-by-side
        flexDirection: 'row',
        padding: 12, // Padding applied here now
        alignItems: 'center', // Vertically center image and details block
    },
    separator: { // Separator style
         height: 1,
         backgroundColor: '#EEEEEE', // Use a light color
         // marginLeft: 12 + 70 + 12, // Optional: Indent separator past image (padding + image width + margin)
    },
    orderItemImage: {
        width: 65, // Keep image size reasonable
        height: 65,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: PlaceholderBgColor,
    },
    mainDetailsColumn: { // Column for ID, User, Date, Payment Badge
        flex: 1, // Takes up available space left of the right column
        justifyContent: 'space-around', // Distribute content vertically
        // backgroundColor: 'lightblue', // DEBUG: See area
    },
    rightColumn: { // Column for Total (implicitly includes space for status)
        width: 90, // Fixed width for alignment
        justifyContent: 'flex-end', // Push total to the bottom
        alignItems: 'flex-end', // Align total to the right
        alignSelf: 'stretch', // Make it take full height of the row
        // backgroundColor: 'lightgreen', // DEBUG: See area
        paddingBottom: 2, // Align total nicely
    },

    orderIdentifierText: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4 },
    userInfoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
    iconStyle: { marginRight: 6 },
    customerTextValue: { fontSize: 14, color: TextColorPrimary, fontWeight: '500', flexShrink: 1 },
    secondaryInfoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
    detailText: { fontSize: 12, color: TextColorSecondary },
    paymentTypeContainer: { // Container for payment badge
        alignItems: 'flex-start', // Keep badge aligned left
        marginTop: 4,
    },
    typeBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
    typeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
    totalValueText: { // Total style
        fontSize: 15, // Make total clear
        fontWeight: 'bold',
        color: AccentColor,
    },

    // --- Status Container (Absolutely Positioned) ---
    statusContainerAbsolute: {
         position: 'absolute',
         right: 12, // Align with item padding
         top: 0,
         bottom: 0,
         justifyContent: 'center', // Vertically center content
         alignItems: 'flex-end', // Align badge to the right edge
         // backgroundColor: 'rgba(255,0,0,0.1)', // DEBUG: See area
         // width: 90, // Give it similar width to the right column space if needed
    },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15 }, // Increased padding slightly
    statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 }, // Slightly larger status text

    // --- Loading, Error, Empty, Badges --- (Copied/Adapted)
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: TextColorSecondary },
    errorTextTitle: { fontSize: 18, fontWeight: 'bold', color: AccentColor, textAlign: 'center', marginBottom: 10 },
    errorText: { color: AccentColor, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
    emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
    emptyTextDetail: { color: TextColorSecondary, fontSize: 12, textAlign: 'center', marginTop: 5 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 10 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    // Badge Colors
    statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusActive: { backgroundColor: '#29B6F6' }, statusCancelled: { backgroundColor: '#EF5350' }, statusPaid: { backgroundColor: '#4CAF50' }, statusUnknown: { backgroundColor: '#BDBDBD' }, typeInstallment: { backgroundColor: InstallmentColor }, typeFixed: { backgroundColor: FixedDurationColor }, typeUnknown: { backgroundColor: TextColorSecondary },
});