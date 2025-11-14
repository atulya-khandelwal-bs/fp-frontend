import { useState, useRef, useEffect } from "react";
import { SquarePen } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import { ArrowUpDown } from "lucide-react";
import { Search } from "lucide-react";
import config from "../../common/config.js";

export default function ConversationList({
  conversations = [],
  selectedConversation,
  onSelectConversation,
  userId,
  onAddConversation,
  sortOrder = "newest",
  onSortOrderChange,
  filterType = "all",
  onFilterTypeChange,
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const sortButtonRef = useRef(null);
  const sortDropdownRef = useRef(null);
  const filterButtonRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const handleAddConversation = () => {
    if (newContactId.trim() && newContactName.trim()) {
      onAddConversation({
        id: newContactId,
        name: newContactName,
        lastSeen: "Just now",
        lastMessage: "",
        timestamp: new Date(),
      });
      setNewContactId("");
      setNewContactName("");
      setShowAddForm(false);
    }
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    if (!date) return "";
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "";

    const now = new Date();
    const diffInMinutes = Math.floor((now - dateObj) / (1000 * 60));
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  // Handle sort option selection
  const handleSortOption = (option) => {
    if (onSortOrderChange) {
      onSortOrderChange(option);
    }
    setShowSortModal(false);
  };

  // Handle filter option selection
  const handleFilterOption = (option) => {
    if (onFilterTypeChange) {
      onFilterTypeChange(option);
    }
    setShowFilterModal(false);
  };

  // Focus search input when it becomes visible
  useEffect(() => {
    if (showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchInput]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close sort dropdown
      if (
        showSortModal &&
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target) &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(event.target)
      ) {
        setShowSortModal(false);
      }
      // Close filter dropdown
      if (
        showFilterModal &&
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target)
      ) {
        setShowFilterModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSortModal, showFilterModal]);

  // Filter and sort conversations
  const getFilteredAndSortedConversations = () => {
    // First, filter out the logged-in user (user can't send messages to themselves)
    let filtered = conversations.filter((conv) => conv.id !== userId);

    // Then apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((conv) => {
        const nameMatch = conv.name?.toLowerCase().includes(query);
        const contactNoMatch = conv.contactNo?.toLowerCase().includes(query);
        const fitpassIdMatch = conv.fitpassId?.toLowerCase().includes(query);
        return nameMatch || contactNoMatch || fitpassIdMatch;
      });
    }

    // Then apply filter type
    if (filterType === "pending_customer") {
      // Reply pending from customer - last message was from doctor (userId)
      filtered = filtered.filter((conv) => conv.lastMessageFrom === userId);
    } else if (filterType === "pending_doctor") {
      // Reply pending from doctor - last message was from customer (not userId)
      filtered = filtered.filter(
        (conv) => conv.lastMessageFrom && conv.lastMessageFrom !== userId
      );
    } else if (filterType === "first_response") {
      // First Response - conversations with no message history
      // A conversation has no message history if:
      // 1. lastMessage is empty/undefined/null/whitespace, AND
      // 2. lastMessageFrom is undefined (no messages have been sent/received)
      // If lastMessage exists and is not empty, it means there's message history
      filtered = filtered.filter((conv) => {
        const hasNoLastMessage =
          !conv.lastMessage || conv.lastMessage.trim() === "";
        const hasNoLastMessageFrom = !conv.lastMessageFrom;
        // Both conditions must be true for "First Response"
        return hasNoLastMessage && hasNoLastMessageFrom;
      });
    }

    // Then apply sort
    const sorted = [...filtered].sort((a, b) => {
      const timeA =
        a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const timeB =
        b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      if (isNaN(timeA.getTime())) return 1;
      if (isNaN(timeB.getTime())) return -1;

      if (sortOrder === "newest") {
        return timeB - timeA; // Most recent first
      } else {
        return timeA - timeB; // Oldest first
      }
    });
    return sorted;
  };

  const filteredConversations = getFilteredAndSortedConversations();

  return (
    <div className="conversation-list">
      {/* Header */}
      <div className="conversation-header">
        <div className="header-title">
          <span>All Tasks</span>
          {filteredConversations.length > 0 && (
            <span className="task-badge">{filteredConversations.length}</span>
          )}
        </div>
        <div className="header-actions">
          {/* <button
            className="header-icon-btn"
            onClick={() => setShowAddForm(!showAddForm)}
            title="Add conversation"
          >
            <SquarePen />
          </button> */}
          <div className="search-button-wrapper">
            <button
              className={`header-icon-btn ${showSearchInput ? "active" : ""}`}
              onClick={() => {
                setShowSearchInput(!showSearchInput);
                if (showSearchInput) {
                  setSearchQuery("");
                }
              }}
              title="Search conversations"
            >
              <Search />
            </button>
          </div>
          <div className="filter-button-wrapper">
            <button
              ref={filterButtonRef}
              className="header-icon-btn"
              onClick={() => {
                setShowFilterModal(!showFilterModal);
                setShowSearchInput(false);
              }}
              title="Filter conversations"
            >
              <SlidersHorizontal />
            </button>
            {/* Filter Dropdown */}
            {showFilterModal && (
              <div
                ref={filterDropdownRef}
                className="sort-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`sort-dropdown-option ${
                    filterType === "all" ? "active" : ""
                  }`}
                  onClick={() => handleFilterOption("all")}
                >
                  All
                </div>
                <div
                  className={`sort-dropdown-option ${
                    filterType === "pending_customer" ? "active" : ""
                  }`}
                  onClick={() => handleFilterOption("pending_customer")}
                >
                  Reply pending from customer
                </div>
                <div
                  className={`sort-dropdown-option ${
                    filterType === "pending_doctor" ? "active" : ""
                  }`}
                  onClick={() => handleFilterOption("pending_doctor")}
                >
                  Reply pending from doctor
                </div>
                <div
                  className={`sort-dropdown-option ${
                    filterType === "first_response" ? "active" : ""
                  }`}
                  onClick={() => handleFilterOption("first_response")}
                >
                  First Response
                </div>
              </div>
            )}
          </div>
          <div className="sort-button-wrapper">
            <button
              ref={sortButtonRef}
              className="header-icon-btn"
              onClick={() => {
                setShowSortModal(!showSortModal);
                setShowSearchInput(false);
              }}
              title="Sort conversations"
            >
              <ArrowUpDown />
            </button>
            {/* Sorting Dropdown */}
            {showSortModal && (
              <div
                ref={sortDropdownRef}
                className="sort-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`sort-dropdown-option ${
                    sortOrder === "newest" ? "active" : ""
                  }`}
                  onClick={() => handleSortOption("newest")}
                >
                  Newest to Oldest
                </div>
                <div
                  className={`sort-dropdown-option ${
                    sortOrder === "oldest" ? "active" : ""
                  }`}
                  onClick={() => handleSortOption("oldest")}
                >
                  Oldest to Newest
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Input */}
      {showSearchInput && (
        <div className="search-input-container">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by name, contact number, or Fitpass ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Add Conversation Form */}
      {showAddForm && (
        <div className="add-conversation-form">
          <input
            type="text"
            placeholder="Contact ID"
            value={newContactId}
            onChange={(e) => setNewContactId(e.target.value)}
            className="add-form-input"
          />
          <input
            type="text"
            placeholder="Contact Name"
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            className="add-form-input"
          />
          <div className="add-form-actions">
            <button
              className="add-form-btn primary"
              onClick={handleAddConversation}
              disabled={!newContactId.trim() || !newContactName.trim()}
            >
              Add
            </button>
            <button
              className="add-form-btn"
              onClick={() => {
                setShowAddForm(false);
                setNewContactId("");
                setNewContactName("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Conversation Items */}
      <div className="conversations-container">
        {filteredConversations.length === 0 ? (
          <div className="empty-conversations">
            <p>
              {conversations.length === 0
                ? "No conversations yet"
                : searchQuery.trim()
                ? "No conversations match your search"
                : "No conversations match the current filter"}
            </p>
            <p className="empty-hint">
              {conversations.length === 0
                ? "Click the + icon to start a new chat"
                : searchQuery.trim()
                ? "Try a different search term"
                : "Try changing the filter"}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                selectedConversation?.id === conv.id ? "selected" : ""
              }`}
              onClick={() => onSelectConversation(conv)}
            >
              <div className="conversation-left">
                <div className="conversation-avatar">
                  <img
                    src={conv.avatar || config.defaults.avatar}
                    alt={conv.name}
                  />
                </div>
                <div className="conversation-content">
                  <div className="conversation-name">{conv.name}</div>
                  <div className="conversation-preview">
                    {conv.lastMessage || "No messages yet"}
                  </div>
                </div>
              </div>
              <div className="conversation-meta">
                <div className="conversation-time">
                  {formatTimeAgo(conv.timestamp)}
                </div>
                {conv.replyCount > 0 && (
                  <div className="conversation-reply-indicators">
                    {Array.from({ length: Math.min(conv.replyCount, 2) }).map(
                      (_, i) => (
                        <div key={i} className="reply-avatar">
                          <img src={config.defaults.userAvatar} alt="Reply" />
                        </div>
                      )
                    )}
                  </div>
                )}
                <div className="conversation-arrow">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
