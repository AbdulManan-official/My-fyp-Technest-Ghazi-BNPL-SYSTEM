import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    FlatList,
    Dimensions,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Animated,
    Easing
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen';

const { width } = Dimensions.get('window');

const banners = [
    require('../../assets/pic4.jpg'),
    require('../../assets/pic2.jpg'),
    require('../../assets/pic3.jpg'),
];

const placeholderImage = require('../../assets/p3.jpg');

const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    const pulseValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const fetchProducts = async () => {
            setLoadingProducts(true);
            try {
                const productsRef = collection(db, 'Products');
                const q = query(productsRef, orderBy('createdAt', 'desc'), limit(10));
                const querySnapshot = await getDocs(q);
                const productsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || 'Unnamed Product',
                    originalPrice: doc.data().originalPrice,
                    discountedPrice: doc.data().discountedPrice,
                    image: doc.data().media?.images?.[0] || null,
                    description: doc.data().description || '',
                    bnplAvailable: doc.data().paymentOption?.BNPL === true,
                    ...doc.data()
                }));
                setFeaturedProducts(productsData);
            } catch (error) {
                console.error("Error fetching products: ", error);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchProducts();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, {
                    toValue: 1.04,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseValue, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                 Animated.delay(200)
            ])
        ).start();

    }, []);

    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    const renderProductCard = ({ item }) => {
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        const displayOriginalPrice = typeof item.originalPrice === 'number'
            ? `PKR ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number'
            ? `PKR ${item.discountedPrice.toFixed(0)}` : null;

        return (
            <TouchableOpacity
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetails', { product: item })}
            >
                <Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.productImage} resizeMode="contain" />
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.name || ''}</Text>
                <View style={styles.priceContainer}>
                    {displayOriginalPrice && (
                        <Text style={[styles.productPrice, hasDiscount && styles.strikethroughPrice]}>
                            {displayOriginalPrice}
                        </Text>
                    )}
                    {hasDiscount && displayDiscountedPrice && (
                        <Text style={styles.discountedPrice}>
                            {displayDiscountedPrice}
                        </Text>
                    )}
                </View>
                {item.description ? (
                    <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description}
                    </Text>
                 ) : null}
                {item.bnplAvailable && (
                    <View style={styles.bnplBadge}>
                        <MaterialIcons name="verified" size={14} color="#00796B" />
                        <Text style={styles.bnplText}>BNPL Available</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);

    const renderAnimatedTitle = () => (
        <View style={styles.titleOuterContainer}>
            <Animated.View style={[
                 styles.animatedTitleBgContainer,
                 { transform: [{ scale: pulseValue }] }
            ]}>
                <Text style={styles.animatedTitleText}>Products For You</Text>
            </Animated.View>
        </View>
    );

    const renderProductSection = () => {
        if (loadingProducts) {
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF0000" /></View>);
        }
        if (featuredProducts.length === 0) {
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No products found.</Text></View>);
        }
        return (<FlatList
                    data={featuredProducts}
                    renderItem={renderProductCard}
                    keyExtractor={(p) => `product-${p.id}`}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    nestedScrollEnabled={true}
                />);
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />
            <View style={styles.header}>
                <Image source={require('../../assets/cod.png')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        <Icon name="user" size={20} color="white" />
                    </View>
                </TouchableOpacity>
            </View>

            <FlatList
                data={[ { key: 'banner' }, { key: 'productsSection' } ]}
                renderItem={({ item }) => {
                    switch (item.key) {
                        case 'banner':
                            return (
                                <View style={styles.sliderContainer}>
                                    <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={banners} renderItem={renderBanner} keyExtractor={(b, i) => `banner-${i}`} onScroll={onScroll} scrollEventThrottle={16} />
                                    <View style={styles.pagination}>
                                        {banners.map((_, index) => (<View key={`dot-${index}`} style={[styles.dot, currentIndex === index ? styles.activeDot : null]} />))}
                                    </View>
                                </View>
                            );
                        case 'productsSection':
                            return (
                                <View>
                                    {renderAnimatedTitle()}
                                    {renderProductSection()}
                                </View>
                            );
                        default: return null;
                    }
                }}
                keyExtractor={(item) => item.key}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {isDrawerOpen && (
                <View style={styles.drawerOverlay}>
                    <CustomDrawerScreen navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
             )}
        </SafeAreaView>
    );
};

// Styles object with the modified values
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 60 },
    logo: { width: 100, height: 35, resizeMode: 'contain' },
    profileIconContainer: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
    drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(0, 0, 0, 0.3)' },
    sliderContainer: { height: 200, backgroundColor: '#e0e0e0' },
    banner: { width: width, height: 200 },
    pagination: { flexDirection: 'row', position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#FFF', opacity: 0.6 },
    activeDot: { opacity: 1, backgroundColor: '#FF0000' },
    titleOuterContainer: {
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    animatedTitleBgContainer: {
        backgroundColor: '#FF0000',
        paddingVertical: 8,
        paddingHorizontal: 25,
        borderRadius: 20,
        elevation: 4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
    },
    animatedTitleText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    gridContainer: { paddingHorizontal: 10, paddingBottom: 10 },
    productCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: 6,
        flex: 0.5,
        alignItems: 'center',
        padding: 8, // Slightly reduced padding
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        minHeight: 260, // Reduced minHeight
    },
    productImage: {
        width: '100%',
        height: 110, // Reduced image height
        borderRadius: 6,
        marginBottom: 8, // Reduced margin below image
        backgroundColor: '#F0F0F0'
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        minHeight: 18,
        marginBottom: 4, // Reduced margin below name
        paddingHorizontal: 2
    },
    priceContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        flexWrap: 'wrap',
        minHeight: 20
    },
    productPrice: { fontSize: 14, color: '#555' },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', marginRight: 6, fontSize: 13 },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold' },
    productDescription: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 6, // Reduced margin above description
        marginBottom: 6, // Reduced margin below description
        paddingHorizontal: 5,
        minHeight: 28 // Reduced minHeight for description
    },
    bnplBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2F1',
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 8,
        marginTop: 6, // Reduced margin above badge
        marginBottom: 4,
        alignSelf: 'center',
    },
    bnplText: { fontSize: 11, color: '#00695C', marginLeft: 4, fontWeight: '600' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
    noProductsText: { fontSize: 16, color: '#888' },
});

export default HomeScreen;