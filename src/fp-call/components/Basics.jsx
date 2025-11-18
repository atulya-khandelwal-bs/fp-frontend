import {
  LocalUser,
  RemoteUser,
  useIsConnected,
  useJoin,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  usePublish,
  useRemoteUsers,
} from "agora-rtc-react";
import AgoraRTC from "agora-rtc-sdk-ng";
import VirtualBackgroundExtension from "agora-extension-virtual-background";
import { useEffect, useRef, useState } from "react";
import config from "../../common/config.js";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  Palette,
  Sparkles,
  X,
  Droplets,
  Signal,
  ChevronUp,
  Volume2,
  VolumeX,
  MoreVertical,
  Ellipsis,
} from "lucide-react";

export const Basics = ({
  client,
  userId: propUserId,
  peerId: propPeerId,
  channel: propChannel,
  isInitiator,
  onEndCall,
  isAudioCall = false,
}) => {
  const [calling, setCalling] = useState(false);
  const isConnected = useIsConnected();

  // Use props if provided, otherwise use defaults (for standalone mode)
  const isStandalone = !propUserId || !propChannel;
  const [appId, setAppId] = useState(config.agora.rtcAppId);
  const [channel, setChannel] = useState(propChannel || "second-time");
  const [token, setToken] = useState("");

  // Generate UID from userId (convert string to number hash)
  const generateUidFromUserId = (userId) => {
    if (!userId) return "";
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const initialUid = propUserId ? generateUidFromUserId(propUserId) : "";
  const [uid, setUid] = useState(initialUid);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(false);

  const [micOn, setMic] = useState(true);
  const [cameraOn, setCamera] = useState(!isAudioCall);
  const [virtualBackground, setVirtualBackground] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [useAgoraExtension, setUseAgoraExtension] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef(null);
  const videoContainerRef = useRef(null);
  // const [networkStats, setNetworkStats] = useState({
  //   uplinkNetworkQuality: 0,
  //   downlinkNetworkQuality: 0,
  // });

  // Device selection - commented out
  // const [micDevices, setMicDevices] = useState([]);
  // const [cameraDevices, setCameraDevices] = useState([]);
  // const [selectedMic, setSelectedMic] = useState("");
  // const [selectedCamera, setSelectedCamera] = useState("");

  // const [showMicDropdown, setShowMicDropdown] = useState(false);
  // const [showCameraDropdown, setShowCameraDropdown] = useState(false);

  // Track which user is currently main (full screen) - null means local user is main
  const [mainUserId, setMainUserId] = useState(null);

  const { localMicrophoneTrack } = useLocalMicrophoneTrack(micOn);
  const { localCameraTrack } = useLocalCameraTrack(cameraOn && !isAudioCall);
  const remoteUsers = useRemoteUsers();

  // Reset mainUserId when number of users changes or remote user leaves
  useEffect(() => {
    if (remoteUsers.length !== 1) {
      setMainUserId(null);
    } else if (mainUserId !== null) {
      // If we have a mainUserId set but that user is no longer in the list, reset
      const userExists = remoteUsers.some((user) => user.uid === mainUserId);
      if (!userExists) {
        setMainUserId(null);
      }
    }
  }, [remoteUsers.length, mainUserId, remoteUsers]);

  // Agora Virtual Background setup
  const processorRef = useRef(null);
  const extensionRef = useRef(null);
  const loadedImagesRef = useRef(new Map());

  // Preload background images
  useEffect(() => {
    const preloadImages = async () => {
      for (const bg of backgroundOptions) {
        if (bg.type === "image" && bg.url) {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
              img.onload = () => {
                loadedImagesRef.current.set(bg.id, img);
                console.log(`Preloaded image for ${bg.name}`);
                resolve(img);
              };
              img.onerror = reject;
              img.src = bg.url;
            });
          } catch (error) {
            console.error(`Failed to preload image for ${bg.name}:`, error);
          }
        }
      }
    };

    preloadImages();
  }, []);

  useEffect(() => {
    if (!localCameraTrack || isAudioCall) return;

    const setupVirtualBackground = async () => {
      try {
        // Register extension only once
        if (!extensionRef.current) {
          const ext = new VirtualBackgroundExtension();
          AgoraRTC.registerExtensions([ext]);
          extensionRef.current = ext;
        }

        // Create processor if not exists
        if (!processorRef.current && extensionRef.current) {
          processorRef.current = extensionRef.current.createProcessor();
          await processorRef.current.init();
        }

        // Attach processor to camera track
        if (processorRef.current) {
          localCameraTrack
            .pipe(processorRef.current)
            .pipe(localCameraTrack.processorDestination);
        }
      } catch (err) {
        console.error("Error setting up virtual background:", err);
      }
    };

    setupVirtualBackground();
  }, [localCameraTrack]);

  // Enable/disable background effect dynamically
  useEffect(() => {
    const updateBackground = async () => {
      if (!processorRef.current && useAgoraExtension) return;

      try {
        if (virtualBackground && selectedBackground) {
          if (useAgoraExtension && processorRef.current) {
            // Use Agora extension
            let options = {};

            if (selectedBackground === "blur") {
              options = {
                type: "blur",
                blurDegree: 2,
              };
            } else if (selectedBackground) {
              const bg = backgroundOptions.find(
                (bg) => bg.id === selectedBackground
              );
              if (bg?.type === "image") {
                // Use preloaded image
                const preloadedImg =
                  loadedImagesRef.current.get(selectedBackground);
                if (preloadedImg) {
                  options = {
                    type: "img",
                    source: preloadedImg,
                  };
                  console.log("Using preloaded image for background");
                } else {
                  console.warn(
                    "Preloaded image not found, falling back to URL"
                  );
                  options = {
                    type: "img",
                    source: bg.url,
                  };
                }
              }
            }

            console.log("Setting background options:", options);
            if (processorRef.current.setOptions) {
              await processorRef.current.setOptions(options);
              await processorRef.current.enable();
            }
          } else {
            // Fallback to CSS-based approach
            console.log("Using CSS-based virtual background fallback");
          }
        } else {
          console.log("Disabling virtual background");
          if (
            useAgoraExtension &&
            processorRef.current &&
            processorRef.current.disable
          ) {
            await processorRef.current.disable();
          }
        }
      } catch (error) {
        console.error("Error updating background:", error);
        // If Agora extension fails, fallback to CSS
        if (useAgoraExtension) {
          console.log("Agora extension failed, falling back to CSS approach");
          setUseAgoraExtension(false);
        }
      }
    };

    updateBackground();
  }, [virtualBackground, selectedBackground, useAgoraExtension]);

  // Load available devices - commented out
  // useEffect(() => {
  //   const loadDevices = async () => {
  //     try {
  //       const devices = await AgoraRTC.getDevices();
  //       const mics = devices.filter((d) => d.kind === "audioinput");
  //       const cams = devices.filter((d) => d.kind === "videoinput");

  //       setMicDevices(mics);
  //       setCameraDevices(cams);

  //       // Set default devices only if not already set
  //       setSelectedMic((prev) => {
  //         if (!prev && mics.length > 0) return mics[0].deviceId;
  //         return prev;
  //       });
  //       setSelectedCamera((prev) => {
  //         if (!prev && cams.length > 0) return cams[0].deviceId;
  //         return prev;
  //       });
  //     } catch (err) {
  //       console.error("Error loading devices:", err);
  //     }
  //   };

  //   loadDevices();

  //   // Auto-refresh devices when plugged/unplugged
  //   navigator.mediaDevices.ondevicechange = loadDevices;
  // }, []);

  // Close more options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        !target.closest(".more-options-menu") &&
        !target.closest(".more-options-button")
      ) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMoreOptions]);

  // Auto-hide controls on mobile after 10 seconds
  useEffect(() => {
    if (!isConnected || !videoContainerRef.current) return;

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const container = videoContainerRef.current;

    const resetTimer = () => {
      // Clear existing timer
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }

      // Show controls
      setControlsVisible(true);

      // Set timer to hide after 10 seconds
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 10000);
    };

    // Initial timer
    resetTimer();

    // Handle user interaction
    const handleUserInteraction = (e) => {
      // Don't reset timer if clicking on control buttons (they handle their own visibility)
      if (
        e.target.closest(".control-bar") ||
        e.target.closest(".call-header")
      ) {
        resetTimer();
        return;
      }
      resetTimer();
    };

    // Add event listeners for various user interactions
    container.addEventListener("click", handleUserInteraction);
    container.addEventListener("touchstart", handleUserInteraction);
    container.addEventListener("mousemove", handleUserInteraction);

    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      container.removeEventListener("click", handleUserInteraction);
      container.removeEventListener("touchstart", handleUserInteraction);
      container.removeEventListener("mousemove", handleUserInteraction);
    };
  }, [isConnected]);

  // Ensure camera track device is set - commented out
  // useEffect(() => {
  //   if (!localCameraTrack || !cameraOn) return;

  //   const ensureTrackReady = async () => {
  //     try {
  //       const trackMediaStreamTrack = localCameraTrack.getMediaStreamTrack();

  //       // Set device if we have a selected camera and it's different
  //       if (selectedCamera && localCameraTrack.setDevice) {
  //         try {
  //           const currentDeviceId =
  //             trackMediaStreamTrack?.getSettings()?.deviceId;
  //           if (currentDeviceId !== selectedCamera) {
  //             await localCameraTrack.setDevice(selectedCamera);
  //             console.log("Camera device set to:", selectedCamera);
  //           }
  //         } catch (deviceErr) {
  //           console.warn("Failed to set camera device:", deviceErr);
  //         }
  //       }
  //     } catch (error) {
  //       console.error("Error ensuring camera track is ready:", error);
  //     }
  //   };

  //   ensureTrackReady();
  // }, [localCameraTrack, cameraOn, selectedCamera]);

  // Device change handlers - commented out
  // const handleMicChange = async (deviceId) => {
  //   try {
  //     setSelectedMic(deviceId);
  //     if (localMicrophoneTrack) {
  //       await localMicrophoneTrack.setDevice(deviceId);
  //       console.log("Switched microphone to:", deviceId);
  //     }
  //   } catch (err) {
  //     console.error("Error switching microphone:", err);
  //   }
  // };

  // const handleCameraChange = async (deviceId) => {
  //   try {
  //     setSelectedCamera(deviceId);
  //     if (localCameraTrack) {
  //       await localCameraTrack.setDevice(deviceId);
  //       console.log("Switched camera to:", deviceId);
  //     }
  //   } catch (err) {
  //     console.error("Error switching camera:", err);
  //   }
  // };

  useJoin(
    {
      appid: appId,
      channel,
      token: token || null,
      uid: typeof uid === "number" ? uid : undefined,
    },
    calling
  );
  usePublish(
    isAudioCall
      ? [localMicrophoneTrack]
      : [localMicrophoneTrack, localCameraTrack]
  );

  // Network monitoring using Agora client events
  // useEffect(() => {
  //   if (!isConnected || !client) return;

  //   console.log("Setting up network quality monitoring...");

  //   // Listen for network quality events
  //   const handleNetworkQuality = (stats) => {
  //     console.log("Uplink Network Quality:", stats.uplinkNetworkQuality);
  //     console.log("Downlink Network Quality:", stats.downlinkNetworkQuality);

  //     // Update network stats with only the two quality values
  //     setNetworkStats({
  //       uplinkNetworkQuality: stats.uplinkNetworkQuality || 0,
  //       downlinkNetworkQuality: stats.downlinkNetworkQuality || 0,
  //     });
  //   };

  //   // Add event listener for network quality
  //   client.on("network-quality", handleNetworkQuality);

  //   // Cleanup function
  //   return () => {
  //     client.off("network-quality", handleNetworkQuality);
  //   };
  // }, [isConnected, client]);

  const backgroundOptions = [
    { id: "blur", name: "Blur", type: "blur" },
    {
      id: "office",
      name: "Office",
      type: "image",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop",
    },
    {
      id: "nature",
      name: "Nature",
      type: "image",
      url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
    },
    {
      id: "space",
      name: "Space",
      type: "image",
      url: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=800&h=600&fit=crop",
    },
    {
      id: "beach",
      name: "Beach",
      type: "image",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop",
    },
    {
      id: "city",
      name: "City",
      type: "image",
      url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop",
    },
  ];

  // Helper function to get network quality status based on Agora values
  // const getNetworkQualityStatus = (quality) => {
  //   switch (quality) {
  //     case 0:
  //       return { status: "Unknown", color: "#6c757d", icon: IconCircle };
  //     case 1:
  //       return { status: "Excellent", color: "#28a745", icon: IconCircle };
  //     case 2:
  //       return { status: "Good", color: "#ffc107", icon: IconCircle };
  //     case 3:
  //       return { status: "Poor", color: "#fd7e14", icon: IconCircle };
  //     case 4:
  //       return { status: "Bad", color: "#dc3545", icon: IconCircle };
  //     case 5:
  //       return { status: "Very Bad", color: "#dc3545", icon: IconCircle };
  //     case 6:
  //       return { status: "Disconnected", color: "#6c757d", icon: IconX };
  //     default:
  //       return { status: "Unknown", color: "#6c757d", icon: IconCircle };
  //   }
  // };

  const handleBackgroundSelect = (background) => {
    console.log("Background selected:", background);
    setSelectedBackground(background.id);
    setVirtualBackground(true);
    setShowBackgroundOptions(false);
  };

  const toggleVirtualBackground = () => {
    if (!virtualBackground) {
      setVirtualBackground(true);
      setSelectedBackground("blur");
    } else {
      setVirtualBackground(false);
      setSelectedBackground(null);
    }
  };

  // Generate token from API
  const generateToken = async () => {
    if (!channel || typeof uid !== "number") {
      if (!isStandalone) {
        console.error("Cannot generate token: missing channel or UID");
      } else {
        alert("Please enter channel name and UID");
      }
      return null;
    }
    setGeneratingToken(true);
    try {
      // Use the RTC token API endpoint from config
      const response = await fetch(config.rtcToken.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelName: channel,
          uid: uid,
          expireSecs: 3600,
          role: "publisher",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate token: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.token) {
        const newToken = data.token;
        setToken(newToken);
        console.log(
          "Token generated successfully:",
          newToken.substring(0, 50) + "..."
        );
        return newToken;
      } else {
        throw new Error("Token not found in response");
      }
    } catch (error) {
      console.error("Error generating token:", error);
      alert(
        `Failed to generate token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    } finally {
      setGeneratingToken(false);
    }
  };

  // Auto-generate token when joining if token is empty
  const handleJoinCall = async () => {
    if (!token && channel && typeof uid === "number") {
      // Set pending join flag, then generate token
      setPendingJoin(true);
      const generatedToken = await generateToken();
      if (!generatedToken) {
        setPendingJoin(false);
        alert("Failed to generate token. Cannot join call.");
        return;
      }
      // Token is now set in state, join will happen via useEffect
    } else if (token) {
      setCalling(true);
    } else {
      alert("Token is required to join the call");
    }
  };

  // Auto-join when props are provided (called from chat)
  useEffect(() => {
    if (
      !isStandalone &&
      propChannel &&
      propUserId &&
      !calling &&
      !token &&
      !pendingJoin &&
      typeof uid === "number" &&
      uid > 0
    ) {
      console.log("Auto-joining call with props:", {
        channel: propChannel,
        userId: propUserId,
        uid: uid,
      });
      // Auto-generate token and join
      const autoJoin = async () => {
        setPendingJoin(true);
        const generatedToken = await generateToken();
        if (generatedToken) {
          setToken(generatedToken);
        } else {
          setPendingJoin(false);
          console.error("Failed to auto-generate token");
        }
      };
      autoJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, propChannel, propUserId, uid, calling, token, pendingJoin]);

  // Handle join when token is ready and pending join is set
  useEffect(() => {
    if (pendingJoin && token) {
      console.log(
        "Token ready, joining call with token:",
        token.substring(0, 50) + "..."
      );
      console.log("App ID:", appId);
      console.log("Channel:", channel);
      console.log("UID:", uid);
      setPendingJoin(false);
      // Use setTimeout to ensure state is fully updated and useJoin hook sees the token
      setTimeout(() => {
        console.log("Setting calling to true...");
        setCalling(true);
      }, 300);
    }
  }, [token, pendingJoin, appId, channel, uid]);

  return (
    <>
      {isConnected ? (
        <div className="video-call-container" ref={videoContainerRef}>
          {/* Header */}
          <div
            className={`call-header ${
              controlsVisible ? "controls-visible" : "controls-hidden"
            }`}
            onClick={(e) => {
              // Keep controls visible when interacting with them
              if (window.innerWidth <= 768) {
                setControlsVisible(true);
                if (hideControlsTimerRef.current) {
                  clearTimeout(hideControlsTimerRef.current);
                }
                hideControlsTimerRef.current = setTimeout(() => {
                  setControlsVisible(false);
                }, 10000);
              }
            }}
          >
            <h1 className="call-title">
              {isAudioCall ? "Audio Call" : "Video Call"}
            </h1>
            <div className="participant-count">
              {remoteUsers.length + 1} participant
              {remoteUsers.length !== 0 ? "s" : ""}
            </div>
          </div>

          {/* Video Grid */}
          <div className={`video-grid users-${remoteUsers.length + 1}`}>
            {/* Determine if local user is main based on mainUserId */}
            {remoteUsers.length === 1 && mainUserId === null ? (
              // Local user is main (full screen)
              <>
                <div
                  className="video-item local main-video"
                  // onClick={() => {
                  //   if (remoteUsers.length === 1) {
                  //     setMainUserId(remoteUsers[0].uid);
                  //   }
                  // }}
                  // style={{ cursor: "pointer" }}
                >
                  <div
                    className={`video-container ${
                      virtualBackground && !useAgoraExtension
                        ? "virtual-bg"
                        : ""
                    }`}
                  >
                    {virtualBackground &&
                      !useAgoraExtension &&
                      selectedBackground && (
                        <div className="virtual-background">
                          {selectedBackground === "blur" ? (
                            <div className="blur-background"></div>
                          ) : (
                            <img
                              src={
                                backgroundOptions.find(
                                  (bg) => bg.id === selectedBackground
                                )?.url
                              }
                              alt="Virtual background"
                              className="background-image"
                            />
                          )}
                        </div>
                      )}
                    {localCameraTrack ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                          position:
                            virtualBackground && !useAgoraExtension
                              ? "relative"
                              : "static",
                          zIndex:
                            virtualBackground && !useAgoraExtension ? 2 : 1,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                        }}
                      >
                        {isAudioCall
                          ? "Audio Call"
                          : cameraOn
                          ? "Waiting for camera..."
                          : "Camera off"}
                      </div>
                    )}
                  </div>

                  {/* Network Status Indicator */}
                  {/* <samp className="network-status-indicator">
                    <div
                      className="network-quality"
                      data-quality={getNetworkQualityStatus(
                        networkStats.uplinkNetworkQuality
                      ).status.toLowerCase()}
                    >
                      <span className="network-icon">
                        <Signal
                          size={14}
                          color={
                            getNetworkQualityStatus(
                              networkStats.uplinkNetworkQuality
                            ).color
                          }
                        />
                      </span>
                      <span className="network-text">
                        {
                          getNetworkQualityStatus(
                            networkStats.uplinkNetworkQuality
                          ).status
                        }
                      </span>
                    </div>
                  </samp> */}
                </div>

                {/* Remote user */}
                {remoteUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="video-item remote-overlay"
                    onClick={() => {
                      setMainUserId(user.uid);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <RemoteUser
                      user={user}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                ))}
              </>
            ) : remoteUsers.length === 1 && mainUserId !== null ? (
              // Remote user is main (full screen)
              <>
                {remoteUsers.map((user) => (
                  <div
                    key={user.uid}
                    className="video-item remote-main main-video"
                  >
                    <RemoteUser
                      user={user}
                      // onClick={() => {
                      //   setMainUserId(null);
                      // }}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "8px",
                        // cursor: "pointer",
                      }}
                    />
                  </div>
                ))}

                {/* Local user */}
                <div
                  className="video-item local remote-overlay"
                  onClick={() => {
                    setMainUserId(null);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className={`video-container ${
                      virtualBackground && !useAgoraExtension
                        ? "virtual-bg"
                        : ""
                    }`}
                  >
                    {virtualBackground &&
                      !useAgoraExtension &&
                      selectedBackground && (
                        <div className="virtual-background">
                          {selectedBackground === "blur" ? (
                            <div className="blur-background"></div>
                          ) : (
                            <img
                              src={
                                backgroundOptions.find(
                                  (bg) => bg.id === selectedBackground
                                )?.url
                              }
                              alt="Virtual background"
                              className="background-image"
                            />
                          )}
                        </div>
                      )}
                    {localCameraTrack ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                          position:
                            virtualBackground && !useAgoraExtension
                              ? "relative"
                              : "static",
                          zIndex:
                            virtualBackground && !useAgoraExtension ? 2 : 1,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                        }}
                      >
                        {isAudioCall
                          ? "Audio Call"
                          : cameraOn
                          ? "Waiting for camera..."
                          : "Camera off"}
                      </div>
                    )}
                  </div>

                  {/* Network Status Indicator */}
                  {/* <samp className="network-status-indicator">
                    <div
                      className="network-quality"
                      data-quality={getNetworkQualityStatus(
                        networkStats.uplinkNetworkQuality
                      ).status.toLowerCase()}
                    >
                      <span className="network-icon">
                        <Signal
                          size={14}
                          color={
                            getNetworkQualityStatus(
                              networkStats.uplinkNetworkQuality
                            ).color
                          }
                        />
                      </span>
                      <span className="network-text">
                        {
                          getNetworkQualityStatus(
                            networkStats.uplinkNetworkQuality
                          ).status
                        }
                      </span>
                    </div>
                  </samp> */}
                </div>
              </>
            ) : (
              // Default layout for 1 user or 3+ users (no switching)
              <>
                <div className="video-item local main-video">
                  <div
                    className={`video-container ${
                      virtualBackground && !useAgoraExtension
                        ? "virtual-bg"
                        : ""
                    }`}
                  >
                    {virtualBackground &&
                      !useAgoraExtension &&
                      selectedBackground && (
                        <div className="virtual-background">
                          {selectedBackground === "blur" ? (
                            <div className="blur-background"></div>
                          ) : (
                            <img
                              src={
                                backgroundOptions.find(
                                  (bg) => bg.id === selectedBackground
                                )?.url
                              }
                              alt="Virtual background"
                              className="background-image"
                            />
                          )}
                        </div>
                      )}
                    {localCameraTrack ? (
                      <LocalUser
                        audioTrack={localMicrophoneTrack}
                        cameraOn={cameraOn}
                        micOn={micOn}
                        playAudio={false}
                        videoTrack={localCameraTrack}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "8px",
                          position:
                            virtualBackground && !useAgoraExtension
                              ? "relative"
                              : "static",
                          zIndex:
                            virtualBackground && !useAgoraExtension ? 2 : 1,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "8px",
                        }}
                      >
                        {isAudioCall
                          ? "Audio Call"
                          : cameraOn
                          ? "Waiting for camera..."
                          : "Camera off"}
                      </div>
                    )}
                  </div>

                  {/* Network Status Indicator */}
                  {/* <samp className="network-status-indicator">
                    <div
                      className="network-quality"
                      data-quality={getNetworkQualityStatus(
                        networkStats.uplinkNetworkQuality
                      ).status.toLowerCase()}
                    >
                      <span className="network-icon">
                        <Signal
                          size={14}
                          color={
                            getNetworkQualityStatus(
                              networkStats.uplinkNetworkQuality
                            ).color
                          }
                        />
                      </span>
                      <span className="network-text">
                        {
                          getNetworkQualityStatus(
                            networkStats.uplinkNetworkQuality
                          ).status
                        }
                      </span>
                    </div>
                  </samp> */}
                </div>

                {/* Remote Users */}
                {remoteUsers.map((user) => (
                  <div key={user.uid} className="video-item remote-overlay">
                    <RemoteUser
                      user={user}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Control Bar */}
          <div
            className={`control-bar ${
              controlsVisible ? "controls-visible" : "controls-hidden"
            }`}
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              // Keep controls visible when interacting with them
              if (window.innerWidth <= 768) {
                setControlsVisible(true);
                if (hideControlsTimerRef.current) {
                  clearTimeout(hideControlsTimerRef.current);
                }
                hideControlsTimerRef.current = setTimeout(() => {
                  setControlsVisible(false);
                }, 10000);
              }
            }}
          >
            {/* 1. Speaker/Volume Control */}
            <button
              className={`control-button ${!speakerOn ? "active" : ""}`}
              onClick={() => setSpeakerOn((a) => !a)}
              title={speakerOn ? "Mute speaker" : "Unmute speaker"}
            >
              <div className="control-icon">
                {speakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
            </button>

            {/* 2. Video Camera Control */}
            {!isAudioCall && (
              <button
                className={`control-button ${!cameraOn ? "active" : ""}`}
                onClick={() => setCamera((a) => !a)}
                title={cameraOn ? "Stop video" : "Start video"}
              >
                <div className="control-icon">
                  {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </div>
              </button>
            )}

            {/* 3. End Call (Red Rectangular Button) */}
            <button
              className="control-button danger"
              onClick={() => {
                if (calling && onEndCall) {
                  onEndCall();
                } else {
                  setCalling((a) => !a);
                }
              }}
              title={calling ? "End call" : "Join call"}
              style={{
                borderRadius: "8px",
                minWidth: "60px",
                padding: "0.75rem 1.25rem",
              }}
            >
              <div className="control-icon">
                <Phone size={18} style={{ transform: "rotate(135deg)" }} />
              </div>
            </button>

            {/* 4. Microphone Control */}
            <button
              className={`control-button ${!micOn ? "active" : ""}`}
              onClick={() => setMic((a) => !a)}
              title={micOn ? "Mute microphone" : "Unmute microphone"}
            >
              <div className="control-icon">
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </div>
            </button>

            {/* 5. More Options */}
            {!isAudioCall && (
              <div style={{ position: "relative" }}>
                <button
                  className="control-button more-options-button"
                  onClick={() => setShowMoreOptions((prev) => !prev)}
                  title="More options"
                >
                  <div className="control-icon">
                    <Ellipsis size={18} />
                  </div>
                </button>

                {/* More Options Menu */}
                {showMoreOptions && (
                  <div
                    className="more-options-menu"
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      right: "0",
                      marginBottom: "0.5rem",
                      background: "white",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      padding: "0.5rem",
                      zIndex: 1000,
                      display: "flex",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <button
                      className="control-button"
                      onClick={() => {
                        toggleVirtualBackground();
                        setShowMoreOptions(false);
                      }}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        justifyContent: "center",
                      }}
                      title="Virtual Background"
                    >
                      <div className="control-icon">
                        <Sparkles size={18} />
                      </div>
                    </button>
                    {virtualBackground && (
                      <button
                        className="control-button"
                        onClick={() => {
                          setShowBackgroundOptions(!showBackgroundOptions);
                          setShowMoreOptions(false);
                        }}
                        style={{
                          width: "64px",
                          height: "64px",
                          borderRadius: "50%",
                          justifyContent: "center",
                        }}
                        title="Background Options"
                      >
                        <div className="control-icon">
                          <Palette size={18} />
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Background Options Panel */}
          {showBackgroundOptions && (
            <div className="background-options-panel">
              <div className="background-options-header">
                <h3>Choose Background</h3>
                <button
                  className="close-button"
                  onClick={() => setShowBackgroundOptions(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="background-options-grid">
                {backgroundOptions.map((background) => (
                  <button
                    key={background.id}
                    className={`background-option ${
                      selectedBackground === background.id ? "selected" : ""
                    }`}
                    onClick={() => handleBackgroundSelect(background)}
                  >
                    {background.type === "blur" ? (
                      <div className="background-preview blur-preview">
                        <div className="blur-icon">
                          <Droplets size={24} />
                        </div>
                        <span>{background.name}</span>
                      </div>
                    ) : (
                      <div className="background-preview">
                        <img
                          src={background.url}
                          alt={background.name}
                          className="background-thumbnail"
                        />
                        <span className="background-name">
                          {background.name}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isStandalone ? (
        <div className="join-screen">
          <div className="join-form">
            <h2 className="join-title">Join Video Call</h2>

            <div className="form-group">
              <label className="form-label">App ID</label>
              <input
                className="form-input"
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Enter your App ID"
                value={appId}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Channel Name</label>
              <input
                className="form-input"
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Enter channel name"
                value={channel}
              />
            </div>

            <div className="form-group">
              <label className="form-label">UID</label>
              <input
                className="form-input"
                type="number"
                onChange={(e) => {
                  const value = e.target.value;
                  setUid(value === "" ? "" : Number(value));
                }}
                placeholder="Enter your UID"
                value={uid === "" ? "" : uid}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Token (Optional - Auto-generated if empty)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="form-input"
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your token or generate one"
                  value={token}
                  style={{ flex: 1 }}
                />
                <button
                  className="join-button"
                  onClick={generateToken}
                  disabled={
                    !channel || typeof uid !== "number" || generatingToken
                  }
                  style={{
                    minWidth: "120px",
                    padding: "10px 16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {generatingToken ? "Generating..." : "Generate Token"}
                </button>
              </div>
            </div>

            <button
              className="join-button"
              disabled={!appId || !channel || typeof uid !== "number"}
              onClick={handleJoinCall}
            >
              Join Call
            </button>
          </div>
        </div>
      ) : (
        <div className="join-screen">
          <div className="join-form">
            <h2 className="join-title">Joining call...</h2>
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              Generating token and connecting...
            </p>
          </div>
        </div>
      )}
    </>
  );
};
