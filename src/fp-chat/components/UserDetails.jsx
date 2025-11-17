import { useState } from "react";
import config from "../../common/config.js";

export default function UserDetails({
  selectedContact,
  userId,
  peerId,
  onSend,
}) {
  const [productCount, setProductCount] = useState(3); // Default to 3 products

  // Generate UUID for meal plan update
  const generateUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // All available products for suggestions
  const allProducts = [
    {
      id: "90909",
      title: "What's Up Wellness Sleep Gummies",
      photoUrl:
        "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/demo/product_1000.jpg",
      price: 700,
      discountedPrice: 560,
      description:
        "Formulated with Chamomile, Melatonin, L-Theanine, Tart Cherry, and Vitamin D2 to promote calmness and ensure sound, restful sleep. These sleep gummies work better than any other sleeping pills/sleeping tablets.",
    },
    {
      id: "90910",
      name: "Hello Healthy Coffee (South Indian)",
      photoUrl:
        "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/demo/product_2000.jpg",
      price: 579,
      discountedPrice: 350,
      title: "Hello Healthy Coffee (South Indian)",
      description:
        "Formulated with Chamomile, Melatonin, L-Theanine, Tart Cherry, and Vitamin D2 to promote calmness and ensure sound, restful sleep. These sleep gummies work better than any other sleeping pills/sleeping tablets.",
    },
    {
      id: "90911",
      title: "Max Protein Bar",
      photoUrl:
        "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/demo/product_3000.jpg",
      price: 450,
      discountedPrice: 350,
      description:
        "Formulated with Chamomile, Melatonin, L-Theanine, Tart Cherry, and Vitamin D2 to promote calmness and ensure sound, restful sleep. These sleep gummies work better than any other sleeping pills/sleeping tablets.",
    },
    {
      id: "90912",
      title: "Kikibix 100% Whole Grain Cookies",
      photoUrl:
        "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/demo/product_4000.jpg",
      price: 650,
      discountedPrice: 475,
      description:
        "Formulated with Chamomile, Melatonin, L-Theanine, Tart Cherry, and Vitamin D2 to promote calmness and ensure sound, restful sleep. These sleep gummies work better than any other sleeping pills/sleeping tablets.",
    },
    {
      id: "90913",
      title: "Ginger Honey Tonic",
      photoUrl:
        "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/demo/product_5000.jpg",
      price: 800,
      discountedPrice: 650,
      description:
        "Formulated with Chamomile, Melatonin, L-Theanine, Tart Cherry, and Vitamin D2 to promote calmness and ensure sound, restful sleep. These sleep gummies work better than any other sleeping pills/sleeping tablets.",
    },
  ];

  // Randomly select products based on selected count
  const getRandomProducts = () => {
    const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, productCount);
  };

  // Handle Meal Plan Update API call
  const handleMealPlanUpdate = async () => {
    if (!peerId || !userId) {
      console.error("Missing peerId or userId");
      return;
    }

    try {
      const mealPlanId = generateUUID();
      const description =
        "Non Lactose Diet or Less Carbs diet. Toggle anything";

      const payload = {
        from: userId,
        to: peerId,
        data: {
          id: mealPlanId,
          description: description,
        },
      };

      const response = await fetch(config.api.sendMealPlanUpdate, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send meal plan update: ${response.status}`);
      }

      const result = await response.json();
      console.log("Meal plan update sent successfully:", result);

      // Send message through Agora Chat SDK to display in UI
      const messagePayload = {
        type: "meal_plan_updated",
        id: mealPlanId,
        description: description,
      };
      onSend(JSON.stringify(messagePayload));
    } catch (error) {
      console.error("Error sending meal plan update:", error);
      alert("Failed to send meal plan update. Please try again.");
    }
  };

  // Handle Change Nutritionist API call
  const handleChangeNutritionist = async () => {
    if (!peerId || !userId) {
      console.error("Missing peerId or userId");
      return;
    }

    try {
      // Get a random coach from available coaches (for demo, using a sample)
      const newCoachId = "222"; // You can make this dynamic
      const coachData = {
        id: newCoachId,
        coachId: newCoachId,
        name: "Rohan Desai",
        photoUrl:
          "https://fpdevelopment19.s3.ap-south-1.amazonaws.com/doctors/doctor_222.jpg",
        title: "Senior Nutritionist",
      };

      const payload = {
        from: userId,
        to: peerId,
        data: coachData,
      };

      const response = await fetch(config.api.healthCoachChanged, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to send nutritionist change: ${response.status}`
        );
      }

      const result = await response.json();
      console.log("Nutritionist change sent successfully:", result);

      // Send message through Agora Chat SDK to display in UI
      const messagePayload = {
        type: "new_nutritionist",
        id: coachData.id,
        name: coachData.name,
        title: coachData.title,
        profilePhoto: coachData.photoUrl,
      };
      onSend(JSON.stringify(messagePayload));
    } catch (error) {
      console.error("Error sending nutritionist change:", error);
      alert("Failed to send nutritionist change. Please try again.");
    }
  };

  // Handle Send Products Suggestions API call
  const handleSendProducts = async () => {
    if (!peerId || !userId) {
      console.error("Missing peerId or userId");
      return;
    }

    try {
      const randomProducts = getRandomProducts();
      const payload = {
        from: userId,
        to: peerId,
        products: randomProducts,
      };

      const response = await fetch(config.api.sendProducts, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send products: ${response.status}`);
      }

      const result = await response.json();
      console.log("Products sent successfully:", result);

      // Send message through Agora Chat SDK to display in UI
      const messagePayload = {
        type: "products",
        products: randomProducts,
      };
      onSend(JSON.stringify(messagePayload));
    } catch (error) {
      console.error("Error sending products:", error);
      alert("Failed to send products. Please try again.");
    }
  };

  return (
    <div className="user-details-panel">
      {selectedContact ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.5rem",
          }}
        >
          {/* Products button with count selector */}
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <button
              onClick={handleSendProducts}
              disabled={!selectedContact}
              title="Send Products Suggestions"
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                background: selectedContact ? "#f3f4f6" : "#f9fafb",
                color: selectedContact ? "#374151" : "#9ca3af",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: selectedContact ? "pointer" : "not-allowed",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#e5e7eb";
                  e.target.style.borderColor = "#d1d5db";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#f3f4f6";
                  e.target.style.borderColor = "#e5e7eb";
                }
              }}
            >
              Send Products Suggestions
            </button>
            {/* Product count selector */}
            <div
              style={{
                display: "flex",
                gap: "0.25rem",
                alignItems: "center",
                background: selectedContact ? "#f9fafb" : "#f3f4f6",
                padding: "0.25rem",
                borderRadius: "6px",
                border: "1px solid #e5e7eb",
              }}
            >
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => setProductCount(count)}
                  disabled={!selectedContact}
                  title={`Select ${count} products`}
                  style={{
                    minWidth: "32px",
                    height: "32px",
                    padding: "0.25rem 0.5rem",
                    background:
                      productCount === count
                        ? selectedContact
                          ? "#2563eb"
                          : "#9ca3af"
                        : "transparent",
                    color:
                      productCount === count
                        ? "white"
                        : selectedContact
                        ? "#374151"
                        : "#9ca3af",
                    border: "none",
                    borderRadius: "4px",
                    cursor: selectedContact ? "pointer" : "not-allowed",
                    fontSize: "0.75rem",
                    fontWeight: productCount === count ? 600 : 400,
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedContact && productCount !== count) {
                      e.target.style.background = "#e5e7eb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedContact && productCount !== count) {
                      e.target.style.background = "transparent";
                    }
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={handleMealPlanUpdate}
              disabled={!selectedContact}
              title="Update Meal Plan"
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                background: selectedContact ? "#f3f4f6" : "#f9fafb",
                color: selectedContact ? "#374151" : "#9ca3af",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: selectedContact ? "pointer" : "not-allowed",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#e5e7eb";
                  e.target.style.borderColor = "#d1d5db";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#f3f4f6";
                  e.target.style.borderColor = "#e5e7eb";
                }
              }}
            >
              Update Meal Plan
            </button>
            <button
              onClick={handleChangeNutritionist}
              disabled={!selectedContact}
              title="Change Nutritionist"
              style={{
                flex: 1,
                padding: "0.5rem 0.75rem",
                background: selectedContact ? "#f3f4f6" : "#f9fafb",
                color: selectedContact ? "#374151" : "#9ca3af",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                cursor: selectedContact ? "pointer" : "not-allowed",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#e5e7eb";
                  e.target.style.borderColor = "#d1d5db";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedContact) {
                  e.target.style.background = "#f3f4f6";
                  e.target.style.borderColor = "#e5e7eb";
                }
              }}
            >
              Change Nutritionist
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-user-details">
          <p>In progress</p>
        </div>
      )}
    </div>
  );
}
