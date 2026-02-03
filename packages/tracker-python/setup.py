from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="crm360-tracker",
    version="1.0.0",
    author="CRM360",
    author_email="support@crm360.com",
    description="CRM360 Visitor Tracking SDK for Python",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/crm360/tracker-python",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Framework :: Django",
        "Framework :: Flask",
        "Framework :: FastAPI",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
    ],
    extras_require={
        "flask": ["flask>=2.0.0"],
        "django": ["django>=3.2"],
        "fastapi": ["fastapi>=0.68.0", "httpx>=0.23.0"],
    },
)
