import React, { useState } from 'react';
import './Hashtags.css';
import logo from '../assets/logo.png';  // ✅ Your logo path

const Hashtags = () => {
  const [formData, setFormData] = useState({
    description: '',
    platform: 'instagram',
    targetAudience: 'general',
    language: 'english',
    niche: 'general',
    advanced: {
      tone: 'casual',
      contentType: 'post',
      hashtagsCount: 10,
      trending: true,
      competitor: ''
    }
  });

  const [generatedHashtags, setGeneratedHashtags] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Platforms, audiences, etc. (full options)
  const platforms = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'twitter', label: 'Twitter/X' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'youtube', label: 'YouTube' }
  ];

  const targetAudiences = [
    { value: 'general', label: 'General' },
    { value: 'teenagers', label: 'Teenagers (13-19)' },
    { value: 'young_adults', label: 'Young Adults (20-30)' },
    { value: 'adults', label: 'Adults (30-50)' },
    { value: 'seniors', label: 'Seniors (50+)' },
    { value: 'professionals', label: 'Professionals' }
  ];

  const languages = [
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'arabic', label: 'Arabic' }
  ];

  const niches = [
    { value: 'general', label: 'General' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'fitness', label: 'Fitness' },
    { value: 'food', label: 'Food' },
    { value: 'travel', label: 'Travel' },
    { value: 'tech', label: 'Technology' },
    { value: 'business', label: 'Business' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdvancedChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      advanced: {
        ...prev.advanced,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const generateHashtags = async () => {
    setIsGenerating(true);
    // Mock API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockHashtags = [
      '#aura', '#hashtags', '#socialmedia', '#viral', '#trending',
      '#instagram', '#tiktok', '#contentcreator', '#digitalmarketing',
      '#explorepage', '#fyp', '#reels', '#growth'
    ].slice(0, formData.advanced.hashtagsCount);
    
    setGeneratedHashtags(mockHashtags);
    setPreviewVisible(true);
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedHashtags.join(' '));
    alert('Copied to clipboard! 📋');
  };

  const exportToCSV = () => {
    const csv = `Hashtags\n${generatedHashtags.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aura-hashtags.csv';
    a.click();
  };

  return (
    <div className="hashtags-page">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-left">
          <div className="logo-container">
            <img src={logo} alt="AURA Logo" className="logo" />
            <span className="app-name">AURA</span>
          </div>
        </div>
        <div className="nav-center">
          <button className="nav-btn">Dashboard</button>
          <button className="nav-btn">Suggestions</button>
          <button className="nav-btn">Content Ideas</button>
          <button className="nav-btn">Captions</button>
          <button className="nav-btn active">Hashtags</button>
        </div>
        <div className="nav-right">
          <div className="user-profile">
            <img src="/vite.svg" alt="User" className="profile-img" />
          </div>
        </div>
      </nav>

      <div className="main-content">
        <div className="container">
          {/* Form Section */}
          <div className="form-section">
            <h1 className="page-title">Generate Perfect Hashtags</h1>
            <p className="subtitle">Describe your content and get optimized hashtags</p>

            <div className="form-grid">
              {/* Content Description */}
              <div className="form-group full-width">
                <label>Content Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your content in detail..."
                  className="textarea-large"
                />
              </div>

              {/* Main Options */}
              <div className="form-group">
                <label>Platform</label>
                <select name="platform" value={formData.platform} onChange={handleInputChange}>
                  {platforms.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Target Audience</label>
                <select name="targetAudience" value={formData.targetAudience} onChange={handleInputChange}>
                  {targetAudiences.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Language</label>
                <select name="language" value={formData.language} onChange={handleInputChange}>
                  {languages.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Niche</label>
                <select name="niche" value={formData.niche} onChange={handleInputChange}>
                  {niches.map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
              </div>

              {/* Generate Button */}
              <div className="generate-btn-container">
                <button 
                  className="generate-btn"
                  onClick={generateHashtags}
                  disabled={!formData.description.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="spinner"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Hashtags'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {previewVisible && generatedHashtags.length > 0 && (
            <div className="preview-section">
              <div className="preview-header">
                <h2>Hashtag Preview</h2>
                <div className="preview-actions">
                  <button className="action-btn copy-btn" onClick={copyToClipboard}>
                    📋 Copy
                  </button>
                  <button className="action-btn csv-btn" onClick={exportToCSV}>
                    📊 CSV
                  </button>
                </div>
              </div>
              
              <div className="preview-content">
                <div className="hashtags-grid">
                  {generatedHashtags.map((hashtag, index) => (
                    <span key={index} className="hashtag-item">
                      {hashtag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hashtags;