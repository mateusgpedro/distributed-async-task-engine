import React from "react";
import "./App.css";
import TaskDashboard from "./TaskDashboard";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Distributed Async Task Engine</h1>
      </header>
      <main>
        <TaskDashboard />
      </main>
    </div>
  );
}

export default App;
