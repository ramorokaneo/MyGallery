import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, FlatList, StyleSheet } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import axios from 'axios';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('mydatabase.db');

const API_KEY = '4NvbKc0C2mimNP8lTUQtF01taGk7H2znVMCgDpLUGbctbqrpV2h2Jh0y';

export default function App() {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const cameraRef = useRef(null);
  const thumbnailListRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus === 'granted');

      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaStatus !== 'granted') {
        console.error('Media library permission denied');
      }

      createTable();
      fetchImages();
      loadImagesFromDatabase();
    })();
  }, []);

  const createTable = () => {
    db.transaction((tx) => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, uri TEXT NOT NULL, type TEXT, location TEXT, dateTime TEXT)',
        [],
        (_, error) => {
          if (error) {
            console.error('Error creating table:', error);
          } else {
            console.log('Table created successfully');
          }
        }
      );
    });
  };

  const fetchImages = async () => {
    try {
      const response = await axios.get('https://api.pexels.com/v1/curated', {
        headers: {
          Authorization: API_KEY,
        },
      });
      const images = response.data.photos.map((photo) => ({
        id: photo.id,
        uri: photo.src.large,
        thumbnailUri: photo.src.tiny,
        type: 'photo',
      }));
      setSelectedImages(images);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching images:', error);
      setIsLoading(false);
    }
  };

  const loadImagesFromDatabase = () => {
    db.transaction((tx) => {
      tx.executeSql('SELECT * FROM images', [], (_, result) => {
        const rows = result.rows;
        const images = [];
        for (let i = 0; i < rows.length; i++) {
          const { uri, type, location, dateTime } = rows.item(i);
          images.push({
            id: i,
            uri,
            type,
            location: location ? JSON.parse(location) : null,
            dateTime: new Date(dateTime),
          });
        }
        setSelectedImages((prevImages) => [...prevImages, ...images]);
      });
    });
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      saveMedia(photo.uri, 'photo');
    }
  };

  const recordVideo = async () => {
    if (cameraRef.current) {
      const video = await cameraRef.current.recordAsync();
      saveMedia(video.uri, 'video');
    }
  };

  const stopRecordingVideo = async () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
    }
  };

  const saveMedia = async (uri, type) => {
    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      db.transaction((tx) => {
        tx.executeSql(
          'INSERT INTO images (uri, type, location, dateTime) VALUES (?, ?, ?, ?)',
          [uri, type, null, new Date().toISOString()],
          (_, result) => {
            if (result.rowsAffected > 0) {
              console.log('Media saved to database');
              setSelectedImages((prevImages) => [
                ...prevImages,
                { id: prevImages.length, uri, type, location: null, dateTime: new Date() },
              ]);
            } else {
              console.error('Error saving media to database');
            }
          }
        );
      });
    } catch (error) {
      console.error('Error saving media:', error);
    }
  };

  const switchMode = () => {
    setIsCameraMode((prev) => !prev);
  };

  const onLargeListScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    thumbnailListRef.current.scrollToOffset({ offset: offsetY, animated: false });
  };

  const renderCamera = () => (
    <Camera style={styles.camera} type={Camera.Constants.Type.back} ref={cameraRef}>
      <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
        <Text style={styles.captureButtonText}>Take Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.captureButton} onPress={recordVideo}>
        <Text style={styles.captureButtonText}>Record Video</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.captureButton} onPress={stopRecordingVideo}>
        <Text style={styles.captureButtonText}>Stop Recording</Text>
      </TouchableOpacity>
    </Camera>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {isCameraMode ? (
        renderCamera()
      ) : (
        <>
          <FlatList
            data={selectedImages}
            renderItem={({ item }) => (
              <View style={styles.imageContainer}>
                {item.type === 'photo' ? (
                  <Image style={styles.image} source={{ uri: item.uri }} />
                ) : (
                  <Text style={styles.videoText}>Video</Text>
                )}
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={<Text>No media found</Text>}
            onScroll={onLargeListScroll}
            scrollEventThrottle={16}
          />
          <FlatList
            ref={thumbnailListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={selectedImages}
            renderItem={({ item }) => (
              <TouchableOpacity>
                {item.type === 'photo' ? (
                  <Image style={styles.thumbnail} source={{ uri: item.thumbnailUri }} />
                ) : (
                  <Text style={styles.videoText}>Video</Text>
                )}
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={<Text>No media found</Text>}
          />
        </>
      )}
      <TouchableOpacity style={styles.button} onPress={switchMode}>
        <Text style={styles.buttonText}>{isCameraMode ? 'Exit Camera' : 'Open Camera'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: 'white',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
  },
  captureButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  imageContainer: {
    margin: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'gray',
    padding: 5,
  },
  image: {
    height: 200,
    width: '100%',
    resizeMode: 'cover',
  },
  videoText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 90,
  },
  thumbnail: {
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 5,
  },
  button: {
    marginTop: 20,
    height: 50,
    width: '60%',
    backgroundColor: 'skyblue',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
