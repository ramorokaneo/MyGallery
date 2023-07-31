import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { ImagePicker } from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import axios from 'axios';

const SERVER_URL = 'http://your_backend_server_url:5000'; // Replace with your backend server URL

const App = () => {
  const [media, setMedia] = useState([]);

  useEffect(() => {
    getMedia();
  }, []);

  const getMedia = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();

    if (status !== 'granted') {
      alert('Permission to access media library is required.');
      return;
    }

    const mediaAssets = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    });

    setMedia(mediaAssets.assets);
  };

  const handlePickMedia = async () => {
    const permissionCamera = await ImagePicker.requestCameraPermissionsAsync();
    const permissionLibrary = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionCamera.status !== 'granted' || permissionLibrary.status !== 'granted') {
      alert('Both camera and media library permissions are required to take photos and videos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 1,
    });

    if (!result.cancelled) {
      const formData = new FormData();
      formData.append('file', {
        uri: result.uri,
        name: `media.${result.uri.split('.').pop()}`,
        type: `image/${result.uri.split('.').pop()}`, // Change this to 'video/${...}' for videos
      });

      try {
        const response = await axios.post(`${SERVER_URL}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        console.log('Upload successful. Server response:', response.data);
      } catch (error) {
        console.error('Error uploading media:', error);
      }

      setMedia([...media, result]);
      MediaLibrary.createAssetAsync(result.uri);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity onPress={() => viewMedia(item)}>
        <View>
          {item.mediaType === 'photo' ? (
            <Image source={{ uri: item.uri }} style={styles.thumbnail} />
          ) : (
            <Text>Video Thumbnail Placeholder</Text>
          )}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Date & Time: {item.takenAt}</Text>
            <Text style={styles.infoText}>Location: {item.locationInfo}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={media}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
      />
      <TouchableOpacity onPress={handlePickMedia} style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F5FCFF',
  },
  listContainer: {
    flexGrow: 1,
  },
  thumbnail: {
    width: 100,
    height: 100,
    margin: 5,
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'blue',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 24,
  },
  infoContainer: {
    padding: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  infoText: {
    color: '#FFF',
    fontSize: 12,
  },
});

export default App;
