import React from 'react';

function AboutTabs({ activeTab, onChange }) {
  const tabs = [
    { id: 'howToPlay', label: 'How to Play' },
    { id: 'userManual', label: 'User Manual' },
    { id: 'about', label: 'About' }
  ];

  return (
    <div className="about-tabs" role="tablist" aria-label="About sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`about-tab ${activeTab === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default AboutTabs;
