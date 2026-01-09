import sys
import os
import shutil
import unittest

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp_server.filesystem import read_file, list_files, write_file

class TestFilesystemMCP(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_mcp_fs"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        os.makedirs(self.test_dir)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_write_read_list(self):
        file_path = os.path.join(self.test_dir, "test.txt")
        content = "Hello MCP"

        # 1. Test Write
        result_write = write_file(file_path, content)
        print(f"Write Result: {result_write}")
        self.assertTrue("Successfully wrote" in result_write)
        self.assertTrue(os.path.exists(file_path))

        # 2. Test Read
        result_read = read_file(file_path)
        print(f"Read Result: {result_read}")
        self.assertEqual(result_read, content)

        # 3. Test List
        result_list = list_files(self.test_dir)
        print(f"List Result: {result_list}")
        self.assertIn("test.txt", result_list)

if __name__ == '__main__':
    unittest.main()
