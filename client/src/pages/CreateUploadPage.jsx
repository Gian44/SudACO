import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PuzzleSelectionModal from '../components/PuzzleSelectionModal';

function CreateUploadPage({ tab }) {
  const navigate = useNavigate();
  const title = tab === 'create' ? 'Create Puzzle' : 'Upload Puzzle';

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{title}</h1>
          <Link to="/" className="btn btn-secondary">Main Menu</Link>
        </div>

        <PuzzleSelectionModal
          isOpen
          embedded
          showCloseButton={false}
          title={title}
          allowedTabs={[tab]}
          initialTab={tab}
          onPuzzleSelect={(puzzleData) => {
            navigate('/experiment', { state: { initialPuzzleData: puzzleData } });
          }}
          onClose={() => navigate('/')}
        />
      </div>
    </div>
  );
}

export default CreateUploadPage;
