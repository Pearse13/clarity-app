import re
from typing import Dict, Optional

class ContentContextExtractor:
    """Extract relevant context from documents for more accurate text transformations."""
    
    def extract_context(self, document_text: str, selected_text: str) -> Dict:
        """
        Extract contextual information from document text.
        
        Args:
            document_text: The text content of the document
            selected_text: The text selected by the user for transformation
            
        Returns:
            Dict containing extracted context information
        """
        if not document_text or not selected_text:
            return {}
            
        # Find position of selected text in document
        start_pos = document_text.find(selected_text)
        if start_pos == -1:
            return {}
            
        # Get surrounding context (200 chars before and after)
        context_size = 200
        context_start = max(0, start_pos - context_size)
        context_end = min(len(document_text), start_pos + len(selected_text) + context_size)
        surrounding_context = document_text[context_start:context_end]
        
        # Extract title (first non-empty line)
        lines = document_text.split('\n')
        title = next((line for line in lines if line.strip()), "")
        
        # Extract key terms using simple frequency analysis
        words = re.findall(r'\b[A-Za-z][A-Za-z-]{3,}\b', document_text.lower())
        stopwords = {'the', 'and', 'that', 'this', 'with', 'from', 'they', 'have'}
        word_counts = {}
        
        for word in words:
            if word not in stopwords:
                word_counts[word] = word_counts.get(word, 0) + 1
                
        # Get top 10 terms
        key_terms = [word for word, _ in sorted(word_counts.items(), 
                                              key=lambda x: x[1], 
                                              reverse=True)[:10]]
        
        return {
            "title": title[:100] if title else "",
            "surrounding_context": surrounding_context,
            "key_terms": key_terms
        }

# Create a singleton instance
context_extractor = ContentContextExtractor() 