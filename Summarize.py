import boto3
import assemblyai as aai
from transformers import BartForConditionalGeneration, BartTokenizer
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
import os
import sys

# Initialize the model and tokenizer
model = BartForConditionalGeneration.from_pretrained('facebook/bart-large-cnn')
tokenizer = BartTokenizer.from_pretrained('facebook/bart-large-cnn')

# Set your AssemblyAI API key
aai.settings.api_key = ""

# AWS S3 configurations
AWS_ACCESS_KEY = ''
AWS_SECRET_KEY = ''
SOURCE_BUCKET_NAME = 'miniprojecttestbucket'
TARGET_BUCKET_NAME = 'miniprojectfilesbucket'
AWS_REGION = 'eu-north-1'

def list_objects_in_bucket(bucket_name):
    s3_client = boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
    response = s3_client.list_objects_v2(Bucket=bucket_name)
    if 'Contents' in response:
        return [obj['Key'] for obj in response['Contents']]
    else:
        return []

def download_file_from_s3(bucket_name, file_key, download_path):
    s3_client = boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
    s3_client.download_file(bucket_name, file_key, download_path)

def upload_file_to_s3(bucket_name, file_path, file_key):
    s3_client = boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
    s3_client.upload_file(file_path, bucket_name, file_key)

# For paragraph summary
def summarized_text(text, maxSummarylength=900):
    try:
        inputs = tokenizer.encode("summarize: " + text, return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(inputs, max_length=maxSummarylength, min_length=maxSummarylength // 2, length_penalty=2.0, num_beams=4, early_stopping=True)
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        print(f"Error summarizing text: {e}")
        return None

# For recursive level summary
def summarized(text, maxSummarylength=500):
    try:
        inputs = tokenizer.encode("summarize: " + text, return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(inputs, max_length=maxSummarylength, min_length=maxSummarylength // 2, length_penalty=2.0, num_beams=4, early_stopping=True)
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        print(f"Error summarizing text: {e}")
        return None

def summarizeinoneline(text, maxSummarylength=100):
    try:
        inputs = tokenizer.encode("summarize: " + text, return_tensors="pt", max_length=1024, truncation=True)
        summary_ids = model.generate(inputs, max_length=maxSummarylength, min_length=maxSummarylength // 2, length_penalty=2.0, num_beams=4, early_stopping=True)
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        print(f"Error summarizing text to one line: {e}")
        return None

def split_text_into_pieces(text, max_tokens=900, overlapPercent=10):
    tokens = tokenizer.tokenize(text)
    overlap_tokens = int(max_tokens * overlapPercent / 100)
    pieces = [tokens[i:i + max_tokens] for i in range(0, len(tokens), max_tokens - overlap_tokens)]
    text_pieces = [tokenizer.decode(tokenizer.convert_tokens_to_ids(piece), skip_special_tokens=True) for piece in pieces]
    return text_pieces

def recursive_summarized(text, max_length=200, recursionLevel=0):
    recursionLevel += 1
    print("Recursion level:", recursionLevel)
    tokens = tokenizer.tokenize(text)
    expectedCountOfChunks = len(tokens) / max_length
    max_length = int(len(tokens) / expectedCountOfChunks) + 2

    pieces = split_text_into_pieces(text, max_tokens=max_length)
    print("Number of Chunks:", len(pieces))

    summaries = []
    for k in range(len(pieces)):
        piece = pieces[k]
        print("Chunks:", (k+1), "out of", len(pieces), "chunks")
        print(piece)
        summary = summarized(piece, maxSummarylength=max_length // 3 * 2)
        print("SUMMARY:", summary)
        summaries.append(summary)
    concatenated_summary = ' '.join(summaries)

    return concatenated_summary

# List objects in the S3 bucket and select the desired file key

def get_latest_uploaded_file(bucket_name):
  """
  Finds the path of the latest uploaded file in the specified S3 bucket.
  """
  s3_client = boto3.client('s3', aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY)
  response = s3_client.list_objects_v2(Bucket=bucket_name)

  if 'Contents' not in response:
    return None  # No files in the bucket

  # Sort objects by last modified time (descending)
  objects = sorted(response['Contents'], key=lambda obj: obj['LastModified'], reverse=True)
  latest_file = objects[0]

  return latest_file['Key']

FILE_KEY = get_latest_uploaded_file(SOURCE_BUCKET_NAME)
DOWNLOAD_PATH = "downloaded_audio_file"

if not FILE_KEY:
    print("No files found in the bucket.")

download_file_from_s3(SOURCE_BUCKET_NAME, FILE_KEY, DOWNLOAD_PATH)


    # Transcribe the downloaded audio file using AssemblyAI
try:
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(DOWNLOAD_PATH)

        if transcript.status == aai.TranscriptStatus.completed:
            transcribed_text = transcript.text
            final_summary = recursive_summarized(transcribed_text)
            with open("transcribed_text.txt", "w", encoding="utf-8") as file:
                file.write("Transcribed Text:\n" + transcribed_text + "\n\n")

            # Generate the paragraph summary
            summarizedd_text = summarized_text(transcribed_text)
            if summarizedd_text:
                print("\nSummarized Text:\n", summarizedd_text)

                # Generate the one-line summary
                summarizationinone = summarizeinoneline(summarizedd_text)
                if summarizationinone:
                    print("\nOne Line Summary:\n", summarizationinone)

                # Generate the important points
                parser = PlaintextParser.from_string(summarizedd_text, Tokenizer("english"))
                summarizer = LsaSummarizer()
                summary = summarizer(parser.document, sentences_count=5)  # You can adjust the number of sentences in the summary
                important_points = "\n-".join(str(sentence) for sentence in summary)
                print("\nImportant points are:\n", important_points)

                # Save the outputs to text files
                with open("summarized_text.txt", "w", encoding="utf-8") as file:
                    file.write("Summarized Text:\n" + summarizedd_text + "\n\n")

                with open("one_line_summary.txt", "w") as file:
                    file.write("Short Summary:\n" + summarizationinone)

                with open("important_points.txt", "w") as file:
                    file.write("Important Points:\n" + important_points)

                # Upload the text files to the target S3 bucket
                upload_file_to_s3(TARGET_BUCKET_NAME, "transcribed_text.txt", "transcribed_text.txt")
                upload_file_to_s3(TARGET_BUCKET_NAME, "summarized_text.txt", "summarized_text.txt")
                upload_file_to_s3(TARGET_BUCKET_NAME, "one_line_summary.txt", "one_line_summary.txt")
                upload_file_to_s3(TARGET_BUCKET_NAME, "important_points.txt", "important_points.txt")
            else:
                print("Error during text summarization.")
        else:
            print("Transcription error:", transcript.error)
except Exception as e:
    print(f"Error during transcription: {e}")
