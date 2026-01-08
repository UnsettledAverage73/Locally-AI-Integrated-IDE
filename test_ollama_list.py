import asyncio
import ollama

async def main():
    try:
        client = ollama.AsyncClient()
        models = await client.list()
        print(f"Type: {type(models)}")
        print(f"Content: {models}")
        
        if hasattr(models, 'models'):
            print("Has 'models' attribute")
            for m in models.models:
                print(f"Model item type: {type(m)}")
                print(f"Model item dir: {dir(m)}")
                if hasattr(m, 'model'):
                    print(f" - model: {m.model}")
                if hasattr(m, 'name'):
                    print(f" - name: {m.name}")
        elif isinstance(models, dict):
             print("Is dict")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
