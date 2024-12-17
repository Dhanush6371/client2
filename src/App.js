import React, { useEffect, useState } from "react";
import "./App.css";

const App = () => {
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [menuOption, setMenuOption] = useState("All Orders");
  const [newOrderCount, setNewOrderCount] = useState(0); // Track new orders
  const [pendingOrderCount, setPendingOrderCount] = useState(0); // Track pending orders
  const [tapAndCollectCount, setTapAndCollectCount] = useState(0); // Track Tap and Collect orders
  const [lastOrderCount, setLastOrderCount] = useState(0); // Track the previous order count to detect new orders
  
  // Notification sound
  const notificationSound = new Audio("/iphone.mp3"); // Ensure you have a notification sound file at this path

  // Fetch orders from API
  const fetchOrders = async () => {
    try {
      const response = await fetch("http://localhost:5000/getOrders");
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      const data = await response.json();

      // Sort orders by createdAt in descending order (newest first)
      const sortedOrders = data.orders.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setOrders(sortedOrders);
      setError("");

      // Update order counts
      setNewOrderCount(sortedOrders.filter((order) => !order.isDelivered).length);
      setPendingOrderCount(sortedOrders.filter((order) => !order.isDelivered).length);

      // Track Tap and Collect orders
      setTapAndCollectCount(sortedOrders.filter((order) => parseInt(order.tableNumber) === 0 && !order.isDelivered).length);
      
      // Play notification sound if new orders are received
      if (sortedOrders.length > lastOrderCount) {
        notificationSound.play();
      }

      // Update last order count
      setLastOrderCount(sortedOrders.length);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch reservations from API
  const fetchReservations = async () => {
    try {
      const response = await fetch("http://localhost:5000/getReservations");
      if (!response.ok) throw new Error(`Error: ${response.statusText}`);
      const data = await response.json();
      setReservations(data.reservations);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchReservations();
    const intervalId = setInterval(fetchOrders, 10000);
    return () => clearInterval(intervalId);
  }, [lastOrderCount]); // Dependency added to re-fetch when new orders come in

  // Mark an order as delivered
  const handleMarkAsDelivered = async (orderId) => {
    try {
      const response = await fetch("http://localhost:5000/markAsDelivered", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();
      if (response.ok) {
        // Update the order status locally
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId ? { ...order, isDelivered: true } : order
          )
        );

        // Update the count
        setPendingOrderCount((prevCount) => prevCount - 1);
        setTapAndCollectCount((prevCount) =>
          prevCount > 0 && orders.some((order) => order._id === orderId && parseInt(order.tableNumber) === 0)
            ? prevCount - 1
            : prevCount
        );
      } else {
        throw new Error(data.error || "Error marking order as delivered");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Determine Table Status
  const getTableStatus = (tableNumber) => {
    const tableOrders = orders.filter(
      (order) => parseInt(order.tableNumber) === tableNumber
    );
    return tableOrders.some((order) => !order.isDelivered) ? "pending" : "";
  };

  // Render Orders Table
  const renderOrders = () => {
    let filteredOrders = [];

    if (menuOption === "All Orders" || menuOption === "Undelivered Orders") {
      filteredOrders = orders.filter(
        (order) =>
          (menuOption === "All Orders" || !order.isDelivered) &&
          (selectedTable ? parseInt(order.tableNumber) === selectedTable : true)
      );
    } else if (menuOption === "Tap and Collect") {
      filteredOrders = orders.filter((order) => parseInt(order.tableNumber) === 0);
    }

    return (
      <table className="order-table">
        <thead>
          <tr>
            <th>Table Number</th>
            <th>Dishes</th>
            <th>Quantity</th>
            <th>Date</th>
            <th>Time</th>
            {menuOption === "Tap and Collect" && <th>Token ID</th>}
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order) => {
            const date = new Date(order.createdAt);
            return (
              <>
                {order.dishes.map((dish, idx) => (
                  <tr key={`${order._id}-${idx}`}>
                    {/* Show Table Number only on the first row */}
                    {idx === 0 && (
                      <td rowSpan={order.dishes.length}>
                        {order.tableNumber || "Tap and Collect"}
                      </td>
                    )}
                    <td>{dish.name}</td>
                    <td>{dish.quantity}</td>
                    {idx === 0 && (
                      <>
                        <td rowSpan={order.dishes.length}>
                          {date.toLocaleDateString()}
                        </td>
                        <td rowSpan={order.dishes.length}>
                          {date.toLocaleTimeString()}
                        </td>
                        {menuOption === "Tap and Collect" && (
                          <td rowSpan={order.dishes.length}>
                            {order.tokenId || "N/A"}
                          </td>
                        )}
                        <td rowSpan={order.dishes.length}>
                          {order.isDelivered ? "Delivered" : "Pending"}
                        </td>
                        <td rowSpan={order.dishes.length}>
                          {!order.isDelivered && (
                            <button
                              className={`mark-delivered ${order.isDelivered ? 'delivered' : 'pending'}`}
                              onClick={() => handleMarkAsDelivered(order._id)}
                            >
                              {order.isDelivered ? "Delivered" : "Mark as Delivered"}
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    );
  };

  // Render Reservations Table
  const renderReservations = () => (
    <table className="order-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Phone</th>
          <th>No. of Persons</th>
          <th>Date</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {reservations.map((reservation, index) => (
          <tr key={index}>
            <td>{reservation.name}</td>
            <td>{reservation.phone}</td>
            <td>{reservation.persons}</td>
            <td>{reservation.date}</td>
            <td>{reservation.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>Menu</h2>
        <ul className="menu-list">
          {["All Orders", "Undelivered Orders", "Tap and Collect", "Reservations"].map(
            (item) => (
              <li
                key={item}
                className={`menu-item ${menuOption === item ? "active" : ""}`}
                onClick={() => {
                  setMenuOption(item);
                  setSelectedTable(null);
                }}
              >
                <span className="menu-icon">
                  {item === "All Orders"
                    ? "📦"
                    : item === "Undelivered Orders"
                    ? "⏳"
                    : item === "Tap and Collect"
                    ? "🛒"
                    : "📅"}
                </span>
                {item} {item === "All Orders" && newOrderCount > 0 && (
                  <span className="badge">{newOrderCount}</span>
                )}
                {item === "Undelivered Orders" && pendingOrderCount > 0 && (
                  <span className="badge">{pendingOrderCount}</span>
                )}
                {item === "Tap and Collect" && tapAndCollectCount > 0 && (
                  <span className="badge">{tapAndCollectCount}</span>
                )}
              </li>
            )
          )}
        </ul>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {menuOption === "Reservations" ? (
          <div className="reservations-section">
            <h2>Reservations</h2>
            {loading ? (
              <p className="loading">Loading...</p>
            ) : error ? (
              <p className="error">{error}</p>
            ) : (
              renderReservations()
            )}
          </div>
        ) : (
          <>
            {menuOption !== "Tap and Collect" && (
              <div className="tables-section">
                <h2>Tables</h2>
                <div className="table-grid">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((table) => (
                    <button
                      key={table}
                      className={`table-button ${getTableStatus(table)}`}
                      onClick={() => setSelectedTable(table)}
                    >
                      Table {table}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="order-details">
              {loading ? (
                <p className="loading">Loading...</p>
              ) : error ? (
                <p className="error">{error}</p>
              ) : selectedTable || menuOption === "Tap and Collect" ? (
                <>
                  <h2>
                    {menuOption} {selectedTable && `for Table ${selectedTable}`}
                  </h2>
                  {renderOrders()}
                </>
              ) : (
                <p>Select a table to view orders.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
