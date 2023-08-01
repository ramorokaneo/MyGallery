import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, Image, FlatList, StyleSheet, Dimensions, ImageBackground } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import axios from 'axios';
import * as SQLite from 'expo-sqlite';
import FlipCard from 'react-native-flip-card';

const db = SQLite.openDatabase('mydatabase.db');

const API_KEY = 'YOUR_PIXELS_API_KEY';

// Custom hook to run a function at a regular interval
function useInterval(callback, delay) {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      savedCallback.current();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default function App() {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
  const cameraRef = useRef(null);
  const thumbnailListRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(true);

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
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync();
      saveMedia(video.uri, 'video');
    }
  };

  const stopRecordingVideo = async () => {
    if (cameraRef.current && isRecording) {
      setIsRecording(false);
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

  const selectImage = (index) => {
    setSelectedImageIndex(index);
  };

  const renderCamera = () => (
    <Camera style={styles.camera} type={Camera.Constants.Type.back} ref={cameraRef}>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
          <Text style={styles.captureButtonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureButton} onPress={isRecording ? stopRecordingVideo : recordVideo}>
          <Text style={styles.captureButtonText}>
            {isRecording ? 'Stop Recording' : 'Record Video'}
          </Text>
        </TouchableOpacity>
      </View>
    </Camera>
  );

  const screenWidth = Dimensions.get('window').width;
  const thumbnailWidth = screenWidth * 0.2;

  // Function to fetch new images from Pixels API every 120 seconds
  const fetchNewImages = () => {
    fetchImages();
  };

  // Fetch new images every 120 seconds using the custom hook
  useInterval(fetchNewImages, 120000);

  const renderLandingPage = () => (
    <ImageBackground
      source={require('./assets/pexels-vitalina-12587261.jpg')}
      style={styles.landingPageBackground}
    >
      <View style={styles.landingPageContainer}>
        <Text style={styles.landingPageText}>Welcome to the Gallery</Text>
        <TouchableOpacity style={styles.startButton} onPress={() => setShowLandingPage(false)}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {showLandingPage ? (
        renderLandingPage()
      ) : (
        <>
          {isCameraMode ? (
            renderCamera()
          ) : (
            <>
              <FlatList
                data={selectedImages}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.imageContainer, { width: screenWidth, height: screenWidth }]}
                    onPress={() => selectImage(index)}
                  >
                    {item.type === 'photo' ? (
                      <Image
                        style={[
                          styles.image,
                          index === selectedImageIndex && styles.selectedImage,
                          { width: '100%', height: '100%' },
                        ]}
                        source={{ uri: item.uri }}
                      />
                    ) : (
                      <Text style={styles.videoText}>Video</Text>
                    )}
                  </TouchableOpacity>
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
                  <TouchableOpacity
                    style={[styles.thumbnailContainer, { width: thumbnailWidth, height: thumbnailWidth }]}
                    onPress={() => selectImage(item.id)}
                  >
                    {item.type === 'photo' ? (
                      <Image style={[styles.thumbnail, { width: '100%', height: '100%' }]} source={{ uri: item.thumbnailUri }} />
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
        </>
      )}
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
  },
  image: {
    resizeMode: 'cover',
  },
  selectedImage: {
    borderWidth: 3,
    borderColor: 'blue',
  },
  videoText: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: '50%',
  },
  thumbnailContainer: {
    margin: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'gray',
  },
  thumbnail: {
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  landingPageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landingPageBackground: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
    alignItems: 'center',
  },
  landingPageText: {
    fontSize: 30,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginBottom: 30,
    color: 'white',
  },
  startButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'skyblue',
    borderRadius: 10,
  },
  startButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
});
