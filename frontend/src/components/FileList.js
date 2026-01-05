import React from 'react';
import { FiFile, FiInbox } from 'react-icons/fi';
import FileCard from './FileCard';

const FileList = ({ files, loading, onDeleteSuccess, onError }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading files...</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
          <FiInbox className="text-4xl text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No files yet</h3>
        <p className="text-gray-500">
          Upload your first file to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file, index) => (
        <div key={file.id} style={{ animationDelay: `${index * 0.05}s` }} className="animate-slide-up">
          <FileCard 
            file={file} 
            onDeleteSuccess={onDeleteSuccess}
            onError={onError}
          />
        </div>
      ))}
    </div>
  );
};

export default FileList;

