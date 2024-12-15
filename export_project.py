import os

def is_text_file(file_path):
    # Comprueba si el archivo tiene una extensión típica de texto
    text_extensions = ['.html', '.css', '.js', '.json', '.txt', '.py', '.xml', '.md', '.ts', '.tsx', '.prisma', '.env', '.gitignore', '.env.production']
    _, ext = os.path.splitext(file_path)
    return ext in text_extensions

def read_file_content(file_path):
    try:
        # Intentamos leer el archivo como UTF-8
        with open(file_path, 'r', encoding='utf-8') as f_in:
            return f_in.read()
    except UnicodeDecodeError:
        # Si no se puede leer como UTF-8, intentamos con una codificación diferente
        try:
            with open(file_path, 'r', encoding='latin1') as f_in:
                return f_in.read()
        except Exception as e:
            print(f"Error al leer el archivo {file_path}: {e}")
            return None

def export_project_files(root_dir, output_file, ignore_dirs):
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for root, dirs, files in os.walk(root_dir):
            # Excluir directorios que no queremos recorrer
            # Creamos una copia de dirs para evitar modificar la lista mientras la recorremos
            dirs[:] = [d for d in dirs if d not in ignore_dirs]

            for file in files:
                # Obtén la ruta completa del archivo
                file_path = os.path.join(root, file)

                # Si el archivo es de texto, lo procesamos
                if is_text_file(file_path):
                    # Escribe la ruta del archivo al principio
                    f_out.write(f"\n\n# TREE_FILE_PATH: {file_path}\n")
                    
                    # Intenta leer el contenido del archivo
                    content = read_file_content(file_path)
                    
                    # Si el contenido se pudo leer, lo escribimos
                    if content is not None:
                        f_out.write(content)
                else:
                    print(f"Archivo no de texto, ignorado: {file_path}")

# Directorios a ignorar (puedes añadir los que necesites)
ignore_dirs = ['node_modules', 'dist', 'build', 'out', '.git', '__pycache__', 'package-lock', 'backend\package-lock']

# Llamar a la función para exportar los archivos del proyecto
root_dir = './'  # Ajusta según la ubicación de tu proyecto
output_file = 'full_project_v4.txt'

export_project_files(root_dir, output_file, ignore_dirs)

print(f"El proyecto se ha exportado correctamente a {output_file}")