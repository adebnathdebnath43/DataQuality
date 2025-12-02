"""
Simple test to verify embedding generation is working
"""
from app.services.bedrock import BedrockService

def test_embedding():
    print("Testing embedding generation...")
    
    bedrock = BedrockService()
    
    # Test text
    test_text = "This is a test document about Python programming"
    
    try:
        # Try to generate embedding
        embedding = bedrock.get_embedding(test_text)
        
        if embedding and len(embedding) > 0:
            print(f"✅ SUCCESS! Embedding generated.")
            print(f"   Length: {len(embedding)}")
            print(f"   First 5 values: {embedding[:5]}")
            print("\n🎉 Backend is ready to generate embeddings!")
            print("   Run a quality check and embeddings will be created.")
            return True
        else:
            print("❌ FAILED: Embedding is empty")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print("\nPossible issues:")
        print("1. AWS credentials not configured")
        print("2. No access to amazon.titan-embed-text-v1")
        print("3. Network/connection issue")
        return False

if __name__ == "__main__":
    test_embedding()
