import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import FileList from '../components/FileList';
import { FiUpload, FiRefreshCw, FiHardDrive } from 'react-icons/fi';

const Dashboard = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/files/list');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Failed to fetch files:', error);
      addNotification('Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchFiles();
    addNotification('File uploaded successfully!', 'success');
  };

  const handleDeleteSuccess = () => {
    fetchFiles();
    addNotification('File deleted successfully!', 'success');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-slide-down">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-500 mt-1">
                Welcome back, <span className="font-semibold text-gray-700">{user?.username}</span>!
              </p>
            </div>
            <div className="flex items-center space-x-3 bg-gradient-to-r from-primary-50 to-blue-50 px-4 py-3 rounded-xl border border-primary-100">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FiHardDrive className="text-primary-600 text-xl" />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium">Storage Used</div>
                <div className="text-lg font-bold text-gray-800">
                  {formatFileSize(totalSize)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Files</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  {files.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiUpload className="text-blue-600 text-2xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Size</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  {formatFileSize(totalSize)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <FiHardDrive className="text-green-600 text-2xl" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300 animate-fade-in sm:col-span-2 lg:col-span-1" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Role</p>
                <p className="text-3xl font-bold text-gray-800 mt-2 capitalize">
                  {user?.role}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiRefreshCw className="text-purple-600 text-2xl" />
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 animate-slide-up">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Upload File</h2>
          <FileUpload
            onUploadSuccess={handleUploadSuccess}
            onUploadError={(error) => addNotification(error, 'error')}
          />
        </div>

        {/* File List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800">Your Files</h2>
            <button
              onClick={fetchFiles}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-all duration-200 disabled:opacity-50 border border-primary-200 font-medium"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
          <FileList
            files={files}
            loading={loading}
            onDeleteSuccess={handleDeleteSuccess}
            onError={(error) => addNotification(error, 'error')}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

