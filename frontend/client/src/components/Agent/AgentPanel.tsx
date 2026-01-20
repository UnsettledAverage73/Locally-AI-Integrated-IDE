import React from 'react';

const AgentPanel: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-gray-800 text-white">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold">AI Agent</h2>
      </div>
      <div className="flex-grow p-4 overflow-y-auto">
        {/* Chat messages will go here */}
        <p>Welcome to the AI Agent. How can I help you today?</p>
      </div>
      <div className="p-4 border-t border-gray-700">
        <textarea
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message..."
        />
      </div>
    </div>
  );
};

export default AgentPanel;
