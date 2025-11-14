export default function InfoTab({ selectedContact }) {
  return (
    <div className="tab-content">
      <div className="info-content">
        <h3>Contact Information</h3>
        <div className="info-item">
          <strong>Name:</strong> {selectedContact?.name || "N/A"}
        </div>
        <div className="info-item">
          <strong>User ID:</strong> {selectedContact?.id || "N/A"}
        </div>
        <div className="info-item">
          <strong>Last Seen:</strong> {selectedContact?.lastSeen || "N/A"}
        </div>
        {selectedContact?.avatar && (
          <div className="info-item">
            <strong>Avatar:</strong>
            <img
              src={selectedContact.avatar}
              alt={selectedContact.name}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                marginTop: "0.5rem",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
