"""
Verification script for Hushh ADK Foundation.
Tests HushhContext, hushh_tool, and HushhAgent basics.
"""
# Adjust path to find hushh_mcp
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.append(os.getcwd())

from hushh_mcp.hushh_adk.context import HushhContext
from hushh_mcp.hushh_adk.tools import hushh_tool


class TestHushhAdkFoundation(unittest.TestCase):
    
    def setUp(self):
        # Mock token object
        self.mock_token_obj = MagicMock()
        self.mock_token_obj.user_id = "user_123"
        self.mock_token_obj.scope = "attr.food.*"
        
    def test_context_storage(self):
        """Test that context is stored and retrieved correctly."""
        print("\n🧪 Testing HushhContext storage...")
        with HushhContext(user_id="user_123", consent_token="token_abc"):  # noqa: S106
            current = HushhContext.current()
            self.assertIsNotNone(current)
            self.assertEqual(current.user_id, "user_123")
            print("✅ Context active inside block")
            
        self.assertIsNone(HushhContext.current())
        print("✅ Context cleared outside block")

    @patch('hushh_mcp.hushh_adk.tools.validate_token')
    def test_tool_decorator_success(self, mock_validate):
        """Test successful tool execution with valid context/token."""
        print("\n🧪 Testing @hushh_tool success...")
        
        # Setup mock validation success
        mock_validate.return_value = (True, "OK", self.mock_token_obj)
        
        # Define tool
        @hushh_tool(scope="attr.food.*")
        def my_test_tool(arg):
            return f"Processed {arg}"
            
        # Run in context
        with HushhContext(user_id="user_123", consent_token="valid_token"):  # noqa: S106
            result = my_test_tool("data")
            self.assertEqual(result, "Processed data")
            print("✅ Tool executed successfully")
            
        mock_validate.assert_called_once()

    @patch('hushh_mcp.hushh_adk.tools.validate_token')
    def test_tool_scope_fail(self, mock_validate):
        """Test tool failure when token scope doesn't match."""
        print("\n🧪 Testing @hushh_tool scope failure...")
        
        # Setup mock validation FAILURE
        mock_validate.return_value = (False, "Scope mismatch", None)
        
        @hushh_tool(scope="attr.food.*")
        def sensitive_tool():
            return "Secret"
            
        with HushhContext(user_id="user_123", consent_token="bad_token"):  # noqa: S106
            with self.assertRaises(PermissionError):
                sensitive_tool()
                
        print("✅ PermissionError raised correctly")

    def test_tool_no_context_fail(self):
        """Test tool failure when called without running agent/context."""
        print("\n🧪 Testing @hushh_tool no-context failure...")
        
        @hushh_tool(scope="generic")
        def naked_tool(): pass
        
        with self.assertRaises(PermissionError):
            naked_tool()
            
        print("✅ PermissionError raised for missing context")

if __name__ == '__main__':
    unittest.main()
