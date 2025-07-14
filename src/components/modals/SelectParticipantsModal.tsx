import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Participant } from '../../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onSelect: (selected: Participant[]) => void;
};

const SelectParticipantsModal: React.FC<Props> = ({ isOpen, onClose, participants, onSelect }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(participants.map(p => p.id));
  const [query, setQuery] = useState('');

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filtered = participants
    .filter((p) =>
      `${p.name} ${p.church}`.toLowerCase().includes(query.trim().toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    setSelectedIds(participants.map(p => p.id)); // reset on open
  }, [participants]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Participants">
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search by name or church"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border border-gray-300 rounded w-full px-3 py-1 mb-3"
        />
        <div className="flex space-x-2 mb-2">
          <Button onClick={() => setSelectedIds(filtered.map(p => p.id))}>Select All</Button>
          <Button variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {filtered.map((p) => (
            <label key={p.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(p.id)}
                onChange={() => toggleId(p.id)}
              />
              <span>{p.name} – {p.church}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => {
            const selected = participants.filter((p) => selectedIds.includes(p.id));
            onSelect(selected);
            onClose();
          }}
        >
          Continue
        </Button>
      </div>
    </Modal>
  );
};

export default SelectParticipantsModal;
