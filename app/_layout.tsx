import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Image, StyleSheet, Animated } from "react-native";
import { useState, useRef } from "react";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/lib/auth-context";
import { ThemeProvider, useThemeMode } from "@/src/lib/theme-context";

// Global register for background tasks and notifications to prevent Android crash
import "@/src/lib/location-task";


SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { effective } = useThemeMode();
  const bg = effective === "dark" ? "#0f1419" : "#f8f9fa";
  return (
    <>
      <StatusBar style={effective === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }} />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  const [isFakeSplashVisible, setIsFakeSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loaded || error) {
      // Hide the native OS splash screen immediately to show our fake one seamlessly
      SplashScreen.hideAsync();
      
      // Wait for 1.5 seconds, then fade out our fake splash screen
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setIsFakeSplashVisible(false));
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStack />
        {isFakeSplashVisible && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 9999, backgroundColor: "#0c2813" }]}>
            <Image 
              source={require("@/assets/images/splash-screen.png")} 
              style={{ width: "100%", height: "100%" }} 
              resizeMode="cover" 
            />
          </Animated.View>
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}
