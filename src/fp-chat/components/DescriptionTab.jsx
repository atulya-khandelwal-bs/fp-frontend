export default function DescriptionTab({ selectedContact }) {
  return (
    <div className="tab-content">
      <div className="description-content">
        <h3>Description</h3>
        <p>
          {selectedContact?.description ||
            "No description available for this contact."}
        </p>
      </div>
    </div>
  );
}
