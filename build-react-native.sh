#!/bin/bash

echo "🚀 SportGate React Native CLI - Fast Local APK Builder"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to check if Android environment is set up
check_android_env() {
    print_color $BLUE "🔍 Checking Android development environment..."
    
    if [ -z "$ANDROID_HOME" ]; then
        print_color $RED "❌ ANDROID_HOME not set. Please install Android Studio and set ANDROID_HOME"
        print_color $YELLOW "📖 Quick setup guide:"
        print_color $YELLOW "   1. Install Android Studio: https://developer.android.com/studio"
        print_color $YELLOW "   2. Add to ~/.bashrc or ~/.zshrc:"
        print_color $YELLOW "      export ANDROID_HOME=\$HOME/Android/Sdk"
        print_color $YELLOW "      export PATH=\$PATH:\$ANDROID_HOME/emulator"
        print_color $YELLOW "      export PATH=\$PATH:\$ANDROID_HOME/platform-tools"
        print_color $YELLOW "   3. Restart terminal and run: source ~/.bashrc"
        exit 1
    fi
    
    if ! command -v adb &> /dev/null; then
        print_color $RED "❌ ADB not found. Please install Android SDK platform-tools"
        exit 1
    fi
    
    print_color $GREEN "✅ Android environment ready"
}

# Function to check for connected devices/emulators
check_android_device() {
    print_color $BLUE "📱 Checking for Android devices..."
    
    DEVICES=$(adb devices | grep -v "List of devices" | grep -v "^$" | wc -l)
    
    if [ $DEVICES -eq 0 ]; then
        print_color $YELLOW "⚠️  No Android devices found. Options:"
        print_color $YELLOW "   1. Connect an Android phone via USB with Developer Options enabled"
        print_color $YELLOW "   2. Start an Android emulator from Android Studio"
        print_color $YELLOW "   3. Continue anyway to build APK only"
        echo ""
        read -p "Continue with APK build only? (y/n): " continue_build
        if [[ $continue_build != "y" ]]; then
            exit 0
        fi
        return 1
    else
        print_color $GREEN "✅ Found $DEVICES Android device(s)"
        adb devices
        return 0
    fi
}

# Function to build APK
build_apk() {
    local app_name=$1
    local app_dir=$2
    
    print_color $BLUE "🔨 Building $app_name APK..."
    
    cd "$app_dir"
    
    # Clean previous build
    print_color $YELLOW "🧹 Cleaning previous build..."
    rm -rf android/app/build/outputs/apk/
    
    # Generate release APK
    print_color $BLUE "📦 Generating release APK (this may take 2-5 minutes)..."
    
    if cd android && ./gradlew assembleRelease; then
        cd ..
        APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
        
        if [ -f "$APK_PATH" ]; then
            # Copy APK to main directory with descriptive name
            cp "$APK_PATH" "../${app_name}-release.apk"
            print_color $GREEN "✅ $app_name APK built successfully!"
            print_color $GREEN "📱 APK location: $(pwd)/../${app_name}-release.apk"
            
            # Get APK size
            APK_SIZE=$(du -h "../${app_name}-release.apk" | cut -f1)
            print_color $BLUE "📊 APK size: $APK_SIZE"
            
            return 0
        else
            print_color $RED "❌ APK file not found after build"
            return 1
        fi
    else
        cd ..
        print_color $RED "❌ Build failed for $app_name"
        return 1
    fi
}

# Function to install APK
install_apk() {
    local app_name=$1
    local apk_path="${app_name}-release.apk"
    
    if [ -f "$apk_path" ]; then
        print_color $BLUE "📲 Installing $app_name on connected device..."
        if adb install -r "$apk_path"; then
            print_color $GREEN "✅ $app_name installed successfully!"
        else
            print_color $YELLOW "⚠️  Installation failed, but APK is ready for manual install"
        fi
    fi
}

# Main script
check_android_env

echo ""
print_color $BLUE "📱 Choose what to build:"
echo "1. SportGate Pass (QR Generator) - Fast local build"
echo "2. SportGate Scan (QR Scanner) - Fast local build"  
echo "3. Both apps"
echo ""
read -p "Enter choice (1/2/3): " choice

DEVICE_AVAILABLE=false
check_android_device && DEVICE_AVAILABLE=true

case $choice in
    1)
        echo ""
        print_color $BLUE "🏗️  Building SportGate Pass (QR Generator)..."
        if build_apk "SportGatePass" "SportGatePass"; then
            if [ "$DEVICE_AVAILABLE" = true ]; then
                install_apk "SportGatePass"
            fi
        fi
        ;;
    2)
        echo ""
        print_color $BLUE "🏗️  Building SportGate Scan (QR Scanner)..."
        if build_apk "SportGateScan" "SportGateScan"; then
            if [ "$DEVICE_AVAILABLE" = true ]; then
                install_apk "SportGateScan"
            fi
        fi
        ;;
    3)
        echo ""
        print_color $BLUE "🏗️  Building both SportGate apps..."
        
        # Build SportGate Pass
        if build_apk "SportGatePass" "SportGatePass"; then
            if [ "$DEVICE_AVAILABLE" = true ]; then
                install_apk "SportGatePass"
            fi
        fi
        
        echo ""
        
        # Build SportGate Scan
        if build_apk "SportGateScan" "SportGateScan"; then
            if [ "$DEVICE_AVAILABLE" = true ]; then
                install_apk "SportGateScan"
            fi
        fi
        ;;
esac

echo ""
print_color $GREEN "🎯 Build Summary:"
echo "  - React Native CLI builds: ⚡ 2-5 minutes (vs 400+ minutes with Expo free tier)"
echo "  - Local development: 🚀 Instant hot reload with Metro"
echo "  - APK generation: 📱 Direct to device installation"
echo "  - No cloud dependencies: 🏠 Everything builds locally"

echo ""
print_color $BLUE "📱 Next steps:"
echo "  - APK files are ready for distribution"
echo "  - Install on any Android device for testing"
echo "  - No more waiting in Expo build queues!"

echo ""
print_color $GREEN "🎪 Ready for Events Committee Demo!"
