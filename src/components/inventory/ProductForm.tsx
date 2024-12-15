// src/components/inventory/ProductForm.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import { productOperations } from '../../lib/database';
import { config } from '../../config';


type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

interface Supplier {
    id: number;
    tradeName: string;
}

interface ProductFormProps {
    onSubmit: () => void;
    initialProduct?: Product;
    onCancel: () => void;
}

const CATEGORIES = ['Wines', 'Beers', 'Spirits', 'Food', 'Others'];

const ProductForm: React.FC<ProductFormProps> = ({
    onSubmit,
    initialProduct,
    onCancel
}) => {
    const [formData, setFormData] = useState({
        name: initialProduct?.name || '',
        barcode: initialProduct?.barcode || '',
        category: initialProduct?.category || CATEGORIES[0],
        supplierId: initialProduct?.supplierId?.toString() || '',
        cost: initialProduct?.cost?.toString() || '',
        price: initialProduct?.price?.toString() || '',
        stock: initialProduct?.stock?.toString() || '',
        minStock: initialProduct?.minStock?.toString() || '',
        imageUrl: initialProduct?.imageUrl || '',
        isActive: initialProduct?.isActive ?? true
    });
    const [suppliers, setSuppliers] = useState<{ id: number, tradeName: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const response = await fetch(`${config.apiUrl}/suppliers/active`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to load suppliers');
                }

                const data = await response.json();
                setSuppliers(data);
            } catch (err) {
                console.error('Error loading suppliers:', err);
            }
        };

        loadSuppliers();
    }, []);

    const handleCameraClick = async () => {
        try {
            console.log('Requesting camera access...');
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            console.log('Camera access granted, stream:', newStream);
            setStream(newStream);
            setShowCamera(true);
        } catch (err: unknown) {
            console.error('Detailed camera error:', err);
            setError(`Could not access camera: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Añadir este useEffect para manejar la inicialización del video
    useEffect(() => {
        if (showCamera && stream && videoRef.current) {
            console.log('Initializing video with stream');
            videoRef.current.srcObject = stream;
            videoRef.current.play()
                .then(() => console.log('Video playing'))
                .catch(err => console.error('Error playing video:', err));
        }

        // Cleanup
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [showCamera, stream]);

    const handleCapture = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) {
            setError('Video stream not ready');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setError('Could not initialize canvas');
                return;
            }

            // Dibujar el frame actual del video
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
            setFormData(prev => ({ ...prev, imageUrl }));

            // Limpiar
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            setShowCamera(false);
        } catch (err) {
            console.error('Error capturing image:', err);
            setError('Failed to capture image');
        }
    };

    // Agregar este useEffect para limpiar el stream cuando se cierra el modal
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const loadSuppliers = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/suppliers/active`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load suppliers');
            }

            const data = await response.json();
            setSuppliers(data);
        } catch (err) {
            setError('Error loading suppliers');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const newValue = type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : value;

        console.log(`Changing ${name} to:`, newValue); // Para debug

        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                console.log('File selected:', file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    console.log('Image converted to base64');
                    setFormData(prev => ({
                        ...prev,
                        imageUrl: reader.result as string
                    }));
                    console.log('Image URL length:', (reader.result as string).length);
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error('Error processing image:', err);
                setError('Error processing image');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const productData: ProductFormData = {
                name: formData.name.trim(),
                barcode: formData.barcode || undefined,
                category: formData.category,
                supplierId: formData.supplierId ? parseInt(formData.supplierId) : undefined,
                cost: parseFloat(formData.cost),
                price: parseFloat(formData.price),
                stock: parseInt(formData.stock),
                minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
                imageUrl: formData.imageUrl || undefined,
                isActive: formData.isActive
            };

            if (initialProduct) {
                await productOperations.update(initialProduct.id, productData);
            } else {
                // Verificar duplicados antes de crear
                const allProducts = await productOperations.getAll();

                // Verificar nombre duplicado
                const duplicateName = allProducts.find(
                    p => p.name.toLowerCase() === productData.name.toLowerCase()
                );
                if (duplicateName) {
                    throw new Error('A product with this name already exists');
                }

                // Verificar código de barras duplicado
                if (productData.barcode) {
                    const duplicateBarcode = allProducts.find(
                        p => p.barcode === productData.barcode
                    );
                    if (duplicateBarcode) {
                        throw new Error('A product with this barcode already exists');
                    }
                }

                await productOperations.create(productData);
            }

            onSubmit();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error saving product');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    maxLength={100}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Barcode</label>
                <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Supplier</label>
                <select
                    name="supplierId"
                    value={formData.supplierId || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                    <option value="">Select a supplier</option>
                    {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                            {supplier.tradeName}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Cost</label>
                <input
                    type="number"
                    name="cost"
                    value={formData.cost}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    step="0.01"
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Stock</label>
                <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Minimum Stock Alert
                </label>
                <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
            </div>

            <div className="flex items-center">
                <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                    Active
                </label>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Image</label>
                <div className="mt-1 flex items-center gap-4">
                    <div className="flex-1">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleCameraClick}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Take Photo
                    </button>
                </div>
                {showCamera && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">Take Photo</h2>
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="relative aspect-video mb-4">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full rounded-lg object-cover bg-black"
                                    autoPlay
                                    playsInline
                                    onError={(e) => {
                                        console.error('Video error:', e);
                                        setError('Error initializing video');
                                    }}
                                />
                                {(!videoRef.current?.srcObject && !stream) && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                        Initializing camera...
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCapture}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                >
                                    Capture
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCamera(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {formData.imageUrl && (
                    <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="mt-2 h-32 w-32 object-cover rounded-md"
                    />
                )}
            </div>

            {error && (
                <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : initialProduct ? 'Update' : 'Add Product'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
};

export default ProductForm;