import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions,StatusBar } from 'react-native';
import { Video } from 'expo-av';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function VideoSplashScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login'); // go to Login screen after 3s
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
        <StatusBar style="light" backgroundColor="#000" translucent={false} />

      <Video
        source={require('../assets/splash.mp4')} // put your splash.mp4 here
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode="cover"
        shouldPlay
        isLooping={false}
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    width,
    height,
  },
});
