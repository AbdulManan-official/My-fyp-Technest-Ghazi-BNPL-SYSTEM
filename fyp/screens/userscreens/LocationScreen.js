import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  Linking,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';

// --- BRANCH 2 SHOP INFORMATION ---
const shopInfo = {
  name: "Ghazi khan Electronics Branch 2",
  address: "HHQ6+4H4, Kubba Chak, Sialkot, Punjab 51310, Pakistan",
  coordinates: {
    latitude: 32.58860732441515,
    longitude: 74.56182092701226,
  },
};
// ----------------------------------

// This object defines the initial map region and zoom level.
const mapRegion = {
  latitude: shopInfo.coordinates.latitude,
  longitude: shopInfo.coordinates.longitude,
  // --- CHANGED: Made the zoom level closer ---
  latitudeDelta: 0.001, 
  longitudeDelta: 0.001,
  // ------------------------------------------
};

export default function LocationScreenBranch2() {
  const markerRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (markerRef.current) {
        markerRef.current.showCallout();
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  const openDirectionsWithConfirmation = () => {
    Alert.alert(
      "Open External App",
      "This will open your device's map app for directions. Do you want to continue?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("User cancelled directions"),
          style: "cancel",
        },
        {
          text: "Open Maps",
          onPress: () => {
            const { latitude, longitude } = shopInfo.coordinates;
            const label = encodeURIComponent(shopInfo.name);
            const url = Platform.select({
              ios: `maps://?daddr=${latitude},${longitude}&q=${label}`,
              android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
            });
            Linking.openURL(url).catch(err =>
              console.error("An error occurred", err)
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <MapView style={styles.map} initialRegion={mapRegion}>
        <Marker
          ref={markerRef}
          coordinate={shopInfo.coordinates}
          title={shopInfo.name}
          description={shopInfo.address}
        />
      </MapView>

      <View style={styles.infoCard}>
        <Text style={styles.shopName}>{shopInfo.name}</Text>
        <Text style={styles.shopAddress}>{shopInfo.address}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={openDirectionsWithConfirmation}
        >
          <Text style={styles.buttonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles remain exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 3,
  },
  infoCard: {
    flex: 2,
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingHorizontal: 25,
    paddingBottom: 15,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  shopAddress: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});