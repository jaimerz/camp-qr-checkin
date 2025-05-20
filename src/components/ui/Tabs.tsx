import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/helpers';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTabId,
  activeTabId,
  onTabChange,
  className,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<string>(defaultTabId || tabs[0]?.id || '');

  const currentTabId = activeTabId !== undefined ? activeTabId : internalActiveTab;

  const handleTabClick = (id: string) => {
    if (onTabChange) {
      onTabChange(id);
    } else {
      setInternalActiveTab(id);
    }
  };

  useEffect(() => {
    if (!currentTabId && tabs.length > 0) {
      const firstTabId = tabs[0].id;
      if (onTabChange) {
        onTabChange(firstTabId);
      } else {
        setInternalActiveTab(firstTabId);
      }
    }
  }, [tabs]);

  const activeTab = tabs.find((tab) => tab.id === currentTabId);

  if (!tabs.length) return null;

  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm',
                currentTabId === tab.id
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {activeTab?.content}
      </div>
    </div>
  );
};

export default Tabs;
