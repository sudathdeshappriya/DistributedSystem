import React, { useState } from 'react';
import api from '../services/api';
import { 
  FiDownload, 
  FiTrash2, 
  FiFile, 
  FiClock,
  FiImage,
  FiVideo,
  FiMusic,
  FiFileText,
  FiArchive,
  FiMoreVertical
} from 'react-icons/fi';

const FileCard = ({ file, onDeleteSuccess, onError }) => {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays < 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) {
      return <FiImage className="text-4xl text-pink-500" />;
    }
    if (mimetype.startsWith('video/')) {
      return <FiVideo className="text-4xl text-purple-500" />;
    }
    if (mimetype.startsWith('audio/')) {
      return <FiMusic className="text-4xl text-green-500" />;
    }
    if (mimetype.includes('pdf') || mimetype.includes('text')) {
      return <FiFileText className="text-4xl text-blue-500" />;
    }
    if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('tar')) {
      return <FiArchive className="text-4xl text-yellow-500" />;
    }
    return <FiFile className="text-4xl text-gray-400" />;
  };

  const getFileBgColor = (mimetype) => {
    if (mimetype.startsWith('image/')) return 'bg-pink-50';
    if (mimetype.startsWith('video/')) return 'bg-purple-50';
    if (mimetype.startsWith('audio/')) return 'bg-green-50';
    if (mimetype.includes('pdf') || mimetype.includes('text')) return 'bg-blue-50';
    if (mimetype.includes('zip') || mimetype.includes('rar')) return 'bg-yellow-50';
    return 'bg-gray-50';
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`/files/download/${file.id}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      onError(error.response?.data?.error || 'Download failed');
    } finally {
      setDownloading(false);
      setShowMenu(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${file.filename}"?`)) {
      setShowMenu(false);
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/files/delete/${file.id}`);
      onDeleteSuccess();
    } catch (error) {
      console.error('Delete error:', error);
      onError(error.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 animate-fade-in overflow-hidden">
      {/* File Icon Header */}
      <div className={`${getFileBgColor(file.mimetype)} p-6 flex items-center justify-center relative`}>
        {getFileIcon(file.mimetype)}
        {/* Menu Button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="absolute top-2 right-2 p-2 rounded-full hover:bg-white/50 transition-colors opacity-0 group-hover:opacity-100"
        >
          <FiMoreVertical className="text-gray-600" />
        </button>
        
        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute top-10 right-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 animate-slide-down min-w-[120px]">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50"
            >
              <FiDownload className="text-primary-600" />
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50"
            >
              <FiTrash2 />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 truncate mb-1" title={file.filename}>
          {file.filename}
        </h3>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <span className="flex items-center space-x-1">
            <FiClock className="text-gray-400" />
            <span>{formatDate(file.uploadedAt)}</span>
          </span>
          <span className="font-medium text-gray-600">{formatFileSize(file.size)}</span>
        </div>
        
        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-gray-100">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <FiDownload className={downloading ? 'animate-spin' : ''} />
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <FiTrash2 className={deleting ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileCard;


