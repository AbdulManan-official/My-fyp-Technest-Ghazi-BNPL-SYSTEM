import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Linking,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';

// --- SHOP INFORMATION ---
const shopInfo = {
  name: "Ghazi khan Electronics Branch 2",
  address: "HHQ6+4H4, Kubba Chak, Sialkot, Punjab 51310, Pakistan",
  coordinates: {
    latitude: 32.5879198759158, 
    longitude: 74.56145070674563
  },
  directionsUrl: "https://maps.app.goo.gl/TtZycmSzrJVpZWva9",
};


// This object defines the initial map region and zoom level.
const mapRegion = {
  latitude: shopInfo.coordinates.latitude,
  longitude: shopInfo.coordinates.longitude,
  latitudeDelta: 0.001, // A small delta means a closer zoom
  longitudeDelta: 0.001,
};

export default function LocationScreenBranch2() {
  const markerRef = useRef(null);

  // This effect automatically shows the marker's title/description after the screen loads.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (markerRef.current) {
        markerRef.current.showCallout();
      }
    }, 500); // Wait half a second before showing
    return () => clearTimeout(timeout); // Clean up the timeout
  }, []);

  // This function shows a confirmation alert before opening the external maps app.
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
            // Open the universal Google Maps link, which works on both iOS and Android.
            Linking.openURL(shopInfo.directionsUrl).catch(err =>
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

      {/* The MapView takes up the top 3/5ths of the screen */}
      <MapView style={styles.map} initialRegion={mapRegion}>
        <Marker
          ref={markerRef}
          coordinate={shopInfo.coordinates}
          title={shopInfo.name}
          description={shopInfo.address}
        />
      </MapView>

      {/* The info card sits on top of the map at the bottom */}
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

// All the styles for the components are defined here.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 3, // Takes 3 parts of the available space
  },
  infoCard: {
    flex: 2, // Takes 2 parts of the available space
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingHorizontal: 25,
    paddingBottom: 15,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -25, // This makes the card overlap the map view
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 10,
    justifyContent: 'center', // Centers the content vertically within the card
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
    backgroundColor: '#007AFF', // A standard blue color
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